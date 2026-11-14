from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user, require_buyer
from app.models.auction import Auction
from app.models.auction_config import AuctionConfiguration
from app.models.auction_supplier import AuctionSupplier
from app.models.activity import AuctionActivity
from app.models.bid import Bid
from app.models.rfq import RFQ
from app.models.user import User
from app.schemas.auction import (
    AuctionCreate,
    AuctionResponse,
    AuctionListItem,
    AuctionDetailResponse,
    AuctionConfigResponse,
    SupplierInvite,
    SupplierInfo,
    ExtensionInfo,
    BidRankItem,
)
from app.services.ranking_service import get_rankings

router = APIRouter(tags=["Auctions"])


@router.post(
    "/rfqs/{rfq_id}/auction",
    response_model=AuctionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_auction(
    rfq_id: UUID,
    auction_data: AuctionCreate,
    buyer: User = Depends(require_buyer),
    db: AsyncSession = Depends(get_db),
) -> AuctionResponse:
    """Create an auction for an RFQ (buyer only)."""
    # Verify the RFQ exists and belongs to the buyer
    result = await db.execute(select(RFQ).where(RFQ.id == rfq_id))
    rfq = result.scalar_one_or_none()
    if not rfq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="RFQ not found"
        )
    if rfq.buyer_id != buyer.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to create auction for this RFQ",
        )

    # Check if auction already exists for this RFQ
    existing = await db.execute(
        select(Auction).where(Auction.rfq_id == rfq_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Auction already exists for this RFQ",
        )

    # Enforce uniqueness: Only one active/scheduled auction with this name
    clean_name = rfq.name.strip()
    active_with_same_name = await db.execute(
        select(Auction)
        .join(RFQ, Auction.rfq_id == RFQ.id)
        .where(
            Auction.rfq_id != rfq_id,
            func.lower(RFQ.name) == clean_name.lower(),
            Auction.status.in_(["ACTIVE", "SCHEDULED"]),
        )
    )
    if active_with_same_name.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An active or scheduled auction with the name '{clean_name}' already exists. There can only be one active auction per name.",
        )

    # Validate times
    if auction_data.forced_close_at <= auction_data.scheduled_close_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="forced_close_at must be after scheduled_close_at",
        )
    if auction_data.scheduled_close_at <= auction_data.start_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="scheduled_close_at must be after start_at",
        )

    # Determine initial status
    now = datetime.now(timezone.utc)
    initial_status = "ACTIVE" if auction_data.start_at <= now else "SCHEDULED"

    # Create auction
    new_auction = Auction(
        rfq_id=rfq_id,
        start_at=auction_data.start_at,
        scheduled_close_at=auction_data.scheduled_close_at,
        current_close_at=auction_data.scheduled_close_at,
        forced_close_at=auction_data.forced_close_at,
        status=initial_status,
    )
    db.add(new_auction)
    await db.flush()

    # Create auction configuration
    config = AuctionConfiguration(
        auction_id=new_auction.id,
        trigger_window_minutes=auction_data.config.trigger_window_minutes,
        extension_minutes=auction_data.config.extension_minutes,
        trigger_bid_received=auction_data.config.trigger_bid_received,
        trigger_any_rank_change=auction_data.config.trigger_any_rank_change,
        trigger_l1_change=auction_data.config.trigger_l1_change,
    )
    db.add(config)

    # Create activity log entry
    activity = AuctionActivity(
        auction_id=new_auction.id,
        actor_user_id=buyer.id,
        event_type="AUCTION_CREATED",
        description=f"Auction created for RFQ {rfq.reference}",
        metadata_json={
            "rfq_reference": rfq.reference,
            "start_at": auction_data.start_at.isoformat(),
            "scheduled_close_at": auction_data.scheduled_close_at.isoformat(),
            "forced_close_at": auction_data.forced_close_at.isoformat(),
        },
    )
    db.add(activity)

    # Auto-invite all existing active suppliers so they can participate immediately
    suppliers_res = await db.execute(select(User).where(User.role == "SUPPLIER", User.is_active == True))
    for s in suppliers_res.scalars().all():
        db.add(AuctionSupplier(auction_id=new_auction.id, supplier_id=s.id, status="INVITED"))

    # Update RFQ status
    rfq.status = "AUCTION_CREATED"
    await db.commit()
    await db.refresh(new_auction)

    return AuctionResponse.model_validate(new_auction)


@router.get("/auctions/", response_model=list[AuctionListItem])
async def list_auctions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AuctionListItem]:
    """List all British auctions with current lowest bid, status, and times."""
    # Assignment: Show a list of all British Auctions
    query = select(Auction).order_by(Auction.created_at.desc())
    result = await db.execute(query)
    auctions = result.scalars().all()

    items: list[AuctionListItem] = []
    for auction in auctions:
        # Get RFQ info
        rfq_result = await db.execute(select(RFQ).where(RFQ.id == auction.rfq_id))
        rfq = rfq_result.scalar_one_or_none()

        # Get current lowest bid
        lowest_result = await db.execute(
            select(func.min(Bid.total_amount)).where(
                Bid.auction_id == auction.id,
                Bid.status == "ACCEPTED",
            )
        )
        lowest_bid = lowest_result.scalar()

        items.append(
            AuctionListItem(
                id=auction.id,
                rfq_id=auction.rfq_id,
                rfq_name=rfq.name if rfq else None,
                rfq_reference=rfq.reference if rfq else None,
                current_lowest_bid=lowest_bid,
                current_close_at=auction.current_close_at,
                forced_close_at=auction.forced_close_at if current_user.role == "BUYER" else None,
                status=auction.status,
            )
        )

    return items


@router.get("/auctions/{auction_id}", response_model=AuctionDetailResponse)
async def get_auction_detail(
    auction_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AuctionDetailResponse:
    """Get full auction detail with bids, rankings, config, extensions, and activity."""
    result = await db.execute(
        select(Auction)
        .options(
            selectinload(Auction.config),
            selectinload(Auction.extensions),
        )
        .where(Auction.id == auction_id)
    )
    auction = result.scalar_one_or_none()

    if not auction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Auction not found"
        )

    # Get RFQ info
    rfq_result = await db.execute(select(RFQ).where(RFQ.id == auction.rfq_id))
    rfq = rfq_result.scalar_one_or_none()

    # Authorization & enrollment
    if current_user.role == "SUPPLIER":
        sup_result = await db.execute(
            select(AuctionSupplier).where(
                AuctionSupplier.auction_id == auction_id,
                AuctionSupplier.supplier_id == current_user.id,
            )
        )
        if not sup_result.scalar_one_or_none():
            # Auto-enroll supplier so they can participate in the British Auction
            assoc = AuctionSupplier(
                auction_id=auction_id,
                supplier_id=current_user.id,
                status="INVITED",
            )
            db.add(assoc)
            await db.commit()

    # Config: Only visible to BUYER (Suppliers must not see extension increments or window parameters)
    config_response = None
    if auction.config and current_user.role == "BUYER":
        config_response = AuctionConfigResponse.model_validate(auction.config)

    # Suppliers
    sup_result = await db.execute(
        select(AuctionSupplier)
        .where(AuctionSupplier.auction_id == auction_id)
        .order_by(AuctionSupplier.invited_at)
    )
    supplier_assocs = sup_result.scalars().all()
    suppliers_list: list[SupplierInfo] = []
    for sa in supplier_assocs:
        user_result = await db.execute(select(User).where(User.id == sa.supplier_id))
        user = user_result.scalar_one_or_none()
        suppliers_list.append(
            SupplierInfo(
                id=sa.id,
                supplier_id=sa.supplier_id,
                status=sa.status,
                supplier_name=user.full_name if user else None,
                supplier_email=user.email if user else None,
                invited_at=sa.invited_at,
                joined_at=sa.joined_at,
            )
        )

    # Bids with rankings
    rankings = await get_rankings(db, auction_id)
    rank_map: dict[UUID, int] = {}
    for idx, r in enumerate(rankings):
        rank_map[r[0]] = idx + 1

    bids_result = await db.execute(
        select(Bid)
        .where(Bid.auction_id == auction_id, Bid.status == "ACCEPTED")
        .order_by(
            Bid.total_amount.asc(),
            Bid.transit_time_hours.asc().nulls_last(),
            Bid.submitted_at.asc(),
        )
    )
    bids = bids_result.scalars().all()
    bids_list: list[BidRankItem] = []
    for bid in bids:
        user_result = await db.execute(select(User).where(User.id == bid.supplier_id))
        user = user_result.scalar_one_or_none()
        bids_list.append(
            BidRankItem(
                id=bid.id,
                auction_id=bid.auction_id,
                supplier_id=bid.supplier_id,
                supplier_name=user.full_name if user else None,
                carrier_name=bid.carrier_name,
                freight_charge=bid.freight_charge,
                origin_charge=bid.origin_charge,
                destination_charge=bid.destination_charge,
                total_amount=bid.total_amount,
                transit_time_hours=bid.transit_time_hours,
                valid_until=bid.valid_until,
                status=bid.status,
                submitted_at=bid.submitted_at,
                rank=rank_map.get(bid.supplier_id, 0),
            )
        )

    # Extensions
    extensions_list: list[ExtensionInfo] = []
    if auction.extensions:
        for ext in sorted(auction.extensions, key=lambda e: e.extended_at):
            extensions_list.append(ExtensionInfo.model_validate(ext))

    return AuctionDetailResponse(
        id=auction.id,
        rfq_id=auction.rfq_id,
        rfq_name=rfq.name if rfq else None,
        rfq_reference=rfq.reference if rfq else None,
        start_at=auction.start_at,
        scheduled_close_at=auction.scheduled_close_at,
        current_close_at=auction.current_close_at,
        forced_close_at=auction.forced_close_at if current_user.role == "BUYER" else None,
        status=auction.status,
        version=auction.version,
        created_at=auction.created_at,
        config=config_response,
        suppliers=suppliers_list,
        bids=bids_list,
        extensions=extensions_list,
    )


@router.post(
    "/auctions/{auction_id}/suppliers",
    response_model=list[SupplierInfo],
    status_code=status.HTTP_201_CREATED,
)
async def invite_suppliers(
    auction_id: UUID,
    invite: SupplierInvite,
    buyer: User = Depends(require_buyer),
    db: AsyncSession = Depends(get_db),
) -> list[SupplierInfo]:
    """Invite suppliers to an auction (buyer only)."""
    # Verify auction exists and belongs to the buyer's RFQ
    result = await db.execute(select(Auction).where(Auction.id == auction_id))
    auction = result.scalar_one_or_none()
    if not auction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Auction not found"
        )

    rfq_result = await db.execute(select(RFQ).where(RFQ.id == auction.rfq_id))
    rfq = rfq_result.scalar_one_or_none()
    if not rfq or rfq.buyer_id != buyer.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to invite suppliers to this auction",
        )

    invited: list[SupplierInfo] = []
    for supplier_id in invite.supplier_ids:
        # Verify supplier exists and is a SUPPLIER
        user_result = await db.execute(
            select(User).where(User.id == supplier_id, User.role == "SUPPLIER")
        )
        user = user_result.scalar_one_or_none()
        if not user:
            continue  # Skip invalid supplier IDs

        # Check if already invited
        existing = await db.execute(
            select(AuctionSupplier).where(
                AuctionSupplier.auction_id == auction_id,
                AuctionSupplier.supplier_id == supplier_id,
            )
        )
        if existing.scalar_one_or_none():
            continue  # Skip already invited

        new_assoc = AuctionSupplier(
            auction_id=auction_id,
            supplier_id=supplier_id,
            status="INVITED",
        )
        db.add(new_assoc)
        await db.flush()

        # Activity log
        db.add(
            AuctionActivity(
                auction_id=auction_id,
                actor_user_id=buyer.id,
                event_type="SUPPLIER_INVITED",
                description=f"Supplier {user.full_name} ({user.email}) invited",
                metadata_json={
                    "supplier_id": str(supplier_id),
                    "supplier_email": user.email,
                },
            )
        )

        invited.append(
            SupplierInfo(
                id=new_assoc.id,
                supplier_id=new_assoc.supplier_id,
                status=new_assoc.status,
                supplier_name=user.full_name,
                supplier_email=user.email,
                invited_at=new_assoc.invited_at,
                joined_at=new_assoc.joined_at,
            )
        )

    await db.commit()
    return invited


@router.get("/auctions/{auction_id}/suppliers", response_model=list[SupplierInfo])
async def list_auction_suppliers(
    auction_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SupplierInfo]:
    """List all suppliers invited to an auction."""
    # Verify auction exists
    result = await db.execute(select(Auction).where(Auction.id == auction_id))
    auction = result.scalar_one_or_none()
    if not auction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Auction not found"
        )

    sup_result = await db.execute(
        select(AuctionSupplier)
        .where(AuctionSupplier.auction_id == auction_id)
        .order_by(AuctionSupplier.invited_at)
    )
    supplier_assocs = sup_result.scalars().all()

    suppliers_list: list[SupplierInfo] = []
    for sa in supplier_assocs:
        user_result = await db.execute(select(User).where(User.id == sa.supplier_id))
        user = user_result.scalar_one_or_none()
        suppliers_list.append(
            SupplierInfo(
                id=sa.id,
                supplier_id=sa.supplier_id,
                status=sa.status,
                supplier_name=user.full_name if user else None,
                supplier_email=user.email if user else None,
                invited_at=sa.invited_at,
                joined_at=sa.joined_at,
            )
        )

    return suppliers_list
