from typing import List, Tuple
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bid import Bid


async def get_rankings(
    db: AsyncSession, auction_id: UUID
) -> List[Tuple[UUID, float, int | None, object]]:
    """
    For each supplier, determine their most competitive accepted bid.
    Rankings order:
    1. total_amount ASC (lowest landed price)
    2. transit_time_hours ASC (faster delivery speed breaks price ties)
    3. submitted_at ASC (earliest quote breaks price and transit ties)

    Returns a list of tuples: (supplier_id, best_total, best_transit, earliest_bid)
    where rankings[0] is the current leading carrier (L1).
    """
    bids_res = await db.execute(
        select(Bid)
        .where(
            Bid.auction_id == auction_id,
            Bid.status == "ACCEPTED",
        )
        .order_by(
            Bid.total_amount.asc(),
            Bid.transit_time_hours.asc().nulls_last(),
            Bid.submitted_at.asc(),
        )
    )
    bids = bids_res.scalars().all()

    seen_suppliers = set()
    rankings: List[Tuple[UUID, float, int | None, object]] = []

    for b in bids:
        if b.supplier_id not in seen_suppliers:
            seen_suppliers.add(b.supplier_id)
            rankings.append((
                b.supplier_id,
                float(b.total_amount),
                b.transit_time_hours,
                b.submitted_at,
            ))

    return rankings
