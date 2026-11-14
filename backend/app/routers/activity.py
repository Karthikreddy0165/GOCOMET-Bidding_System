from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.activity import AuctionActivity
from app.models.auction import Auction
from app.models.user import User
from app.schemas.activity import ActivityResponse

router = APIRouter(tags=["Activity"])


@router.get(
    "/auctions/{auction_id}/activity", response_model=list[ActivityResponse]
)
async def list_activity(
    auction_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ActivityResponse]:
    """Get activity log for an auction."""
    # Verify auction exists
    result = await db.execute(select(Auction).where(Auction.id == auction_id))
    auction = result.scalar_one_or_none()
    if not auction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Auction not found"
        )

    activities_result = await db.execute(
        select(AuctionActivity)
        .where(AuctionActivity.auction_id == auction_id)
        .order_by(AuctionActivity.created_at.desc())
    )
    activities = activities_result.scalars().all()

    response_list: list[ActivityResponse] = []
    for activity in activities:
        actor_name = None
        if activity.actor_user_id:
            user_result = await db.execute(
                select(User).where(User.id == activity.actor_user_id)
            )
            user = user_result.scalar_one_or_none()
            actor_name = user.full_name if user else None

        # Sanitize metadata: Never leak forced_close_at to suppliers
        meta = dict(activity.metadata_json) if activity.metadata_json else {}
        if current_user.role == "SUPPLIER":
            meta.pop("forced_close_at", None)

        response_list.append(
            ActivityResponse(
                id=activity.id,
                auction_id=activity.auction_id,
                actor_user_id=activity.actor_user_id,
                actor_name=actor_name,
                event_type=activity.event_type,
                description=activity.description,
                metadata=meta,
                created_at=activity.created_at,
            )
        )

    return response_list
