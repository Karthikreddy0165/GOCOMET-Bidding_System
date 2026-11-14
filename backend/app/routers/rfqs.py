from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_buyer
from app.models.rfq import RFQ
from app.models.user import User
from app.models.auction_supplier import AuctionSupplier
from app.models.auction import Auction
from app.schemas.rfq import RFQCreate, RFQResponse

router = APIRouter(prefix="/rfqs", tags=["RFQs"])


@router.post("/", response_model=RFQResponse, status_code=status.HTTP_201_CREATED)
async def create_rfq(
    rfq_data: RFQCreate,
    buyer: User = Depends(require_buyer),
    db: AsyncSession = Depends(get_db),
) -> RFQResponse:
    """Create a new RFQ (buyer only)."""
    # Check for duplicate reference
    existing = await db.execute(
        select(RFQ).where(RFQ.reference == rfq_data.reference)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="RFQ reference already exists",
        )

    # Enforce uniqueness: Only one active/scheduled auction with this name
    clean_name = rfq_data.name.strip()
    existing_active = await db.execute(
        select(RFQ)
        .join(Auction, Auction.rfq_id == RFQ.id)
        .where(
            func.lower(RFQ.name) == clean_name.lower(),
            Auction.status.in_(["ACTIVE", "SCHEDULED"]),
        )
    )
    if existing_active.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An active or scheduled auction with the name '{clean_name}' already exists. There can only be one active auction per name.",
        )

    new_rfq = RFQ(
        buyer_id=buyer.id,
        reference=rfq_data.reference,
        name=rfq_data.name,
        description=rfq_data.description,
        pickup_service_at=rfq_data.pickup_service_at,
        status="DRAFT",
    )
    db.add(new_rfq)
    await db.commit()
    await db.refresh(new_rfq)

    return RFQResponse.model_validate(new_rfq)


@router.get("/", response_model=list[RFQResponse])
async def list_rfqs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[RFQResponse]:
    """
    List RFQs.
    - Buyers see their own RFQs.
    - Suppliers see RFQs they are invited to (via auctions).
    """
    if current_user.role == "BUYER":
        result = await db.execute(
            select(RFQ)
            .where(RFQ.buyer_id == current_user.id)
            .order_by(RFQ.created_at.desc())
        )
        rfqs = result.scalars().all()
    else:
        # Supplier: find RFQs where they are invited via auction_suppliers
        result = await db.execute(
            select(RFQ)
            .join(Auction, Auction.rfq_id == RFQ.id)
            .join(AuctionSupplier, AuctionSupplier.auction_id == Auction.id)
            .where(AuctionSupplier.supplier_id == current_user.id)
            .order_by(RFQ.created_at.desc())
        )
        rfqs = result.scalars().all()

    return [RFQResponse.model_validate(rfq) for rfq in rfqs]


@router.get("/{rfq_id}", response_model=RFQResponse)
async def get_rfq(
    rfq_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RFQResponse:
    """Get RFQ detail by ID."""
    result = await db.execute(select(RFQ).where(RFQ.id == rfq_id))
    rfq = result.scalar_one_or_none()

    if not rfq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="RFQ not found"
        )

    # Authorization: buyer owns it, or supplier is invited
    if current_user.role == "BUYER" and rfq.buyer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this RFQ",
        )

    if current_user.role == "SUPPLIER":
        # Check if supplier is invited via any auction on this RFQ
        inv_result = await db.execute(
            select(AuctionSupplier)
            .join(Auction, Auction.id == AuctionSupplier.auction_id)
            .where(
                Auction.rfq_id == rfq_id,
                AuctionSupplier.supplier_id == current_user.id,
            )
        )
        if not inv_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this RFQ",
            )

    return RFQResponse.model_validate(rfq)
