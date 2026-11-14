from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_supplier
from app.models.auction import Auction
from app.models.auction_supplier import AuctionSupplier
from app.models.bid import Bid
from app.models.user import User
from app.schemas.bid import BidSubmit, BidResponse
from app.services.bid_service import submit_bid
from app.services.ranking_service import get_rankings

router = APIRouter(tags=["Bids"])


@router.post(
    "/auctions/{auction_id}/bids",
    response_model=BidResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_bid(
    auction_id: UUID,
    bid_data: BidSubmit,
    supplier: User = Depends(require_supplier),
    db: AsyncSession = Depends(get_db),
) -> BidResponse:
    """Submit a bid to an auction (supplier only)."""
    return await submit_bid(
        db=db,
        auction_id=auction_id,
        supplier_id=supplier.id,
        bid_data=bid_data,
    )


@router.get("/auctions/{auction_id}/bids", response_model=list[BidResponse])
async def list_bids(
    auction_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[BidResponse]:
    """Get all accepted bids for an auction, sorted by total_amount ascending."""
    # Verify auction exists
    result = await db.execute(select(Auction).where(Auction.id == auction_id))
    auction = result.scalar_one_or_none()
    if not auction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Auction not found"
        )

    # Get rankings for rank assignment
    rankings = await get_rankings(db, auction_id)
    rank_map: dict[UUID, int] = {}
    for idx, r in enumerate(rankings):
        rank_map[r[0]] = idx + 1

    # Get all accepted bids
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

    bid_responses: list[BidResponse] = []
    for bid in bids:
        # Get supplier name
        user_result = await db.execute(
            select(User).where(User.id == bid.supplier_id)
        )
        user = user_result.scalar_one_or_none()

        bid_responses.append(
            BidResponse(
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
                rank=rank_map.get(bid.supplier_id),
            )
        )

    return bid_responses
