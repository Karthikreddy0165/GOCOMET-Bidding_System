from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auction import Auction
from app.models.auction_config import AuctionConfiguration
from app.models.auction_extension import AuctionExtension
from app.models.auction_supplier import AuctionSupplier
from app.models.activity import AuctionActivity
from app.models.bid import Bid
from app.schemas.bid import BidSubmit, BidResponse
from app.services.ranking_service import get_rankings
from app.websocket.manager import manager


async def submit_bid(
    db: AsyncSession,
    auction_id: UUID,
    supplier_id: UUID,
    bid_data: BidSubmit,
) -> BidResponse:
    """
    Submit a bid to an auction with full transactional integrity.
    Handles idempotency, ranking changes, auction extension triggers,
    and activity logging within a single transaction.
    """
    try:
        # 1. Lock auction row for update
        result = await db.execute(
            select(Auction).where(Auction.id == auction_id).with_for_update()
        )
        auction = result.scalar_one_or_none()
        if not auction or auction.status != "ACTIVE":
            raise HTTPException(status_code=400, detail="Auction not active")

        # 2. Check time bounds
        now = datetime.now(timezone.utc)
        if now >= auction.forced_close_at or now >= auction.current_close_at:
            raise HTTPException(status_code=400, detail="Auction has closed")

        # 3. Check supplier participation
        sup_result = await db.execute(
            select(AuctionSupplier).where(
                AuctionSupplier.auction_id == auction_id,
                AuctionSupplier.supplier_id == supplier_id,
            )
        )
        supplier_assoc = sup_result.scalar_one_or_none()
        if not supplier_assoc:
            supplier_assoc = AuctionSupplier(
                auction_id=auction_id,
                supplier_id=supplier_id,
                status="JOINED",
            )
            db.add(supplier_assoc)
            await db.flush()

        # 4. Idempotency check
        existing_result = await db.execute(
            select(Bid).where(
                Bid.supplier_id == supplier_id,
                Bid.idempotency_key == bid_data.idempotency_key,
            )
        )
        existing_bid = existing_result.scalar_one_or_none()
        if existing_bid:
            # Return existing bid without re-processing
            return BidResponse(
                id=existing_bid.id,
                auction_id=existing_bid.auction_id,
                supplier_id=existing_bid.supplier_id,
                carrier_name=existing_bid.carrier_name,
                freight_charge=existing_bid.freight_charge,
                origin_charge=existing_bid.origin_charge,
                destination_charge=existing_bid.destination_charge,
                total_amount=existing_bid.total_amount,
                transit_time_hours=existing_bid.transit_time_hours,
                valid_until=existing_bid.valid_until,
                status=existing_bid.status,
                submitted_at=existing_bid.submitted_at,
                rank=None,
            )

        # 5. Calculate total amount
        total = (
            bid_data.freight_charge
            + bid_data.origin_charge
            + bid_data.destination_charge
        )

        # 6. Rule: A single supplier cannot submit the same bid amount again
        same_bid = await db.scalar(
            select(Bid).where(
                Bid.auction_id == auction_id,
                Bid.supplier_id == supplier_id,
                Bid.status == "ACCEPTED",
                Bid.total_amount == total,
            )
        )
        if same_bid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You have already submitted a quote of ₹{total:,.2f}. A supplier cannot submit the same bid amount twice.",
            )

        # 7. Get OLD rankings before this bid
        old_rankings = await get_rankings(db, auction_id)
        old_l1_supplier = old_rankings[0][0] if old_rankings else None
        old_l1_amount = old_rankings[0][1] if old_rankings else None

        # 8. Insert bid
        new_bid = Bid(
            auction_id=auction_id,
            supplier_id=supplier_id,
            idempotency_key=bid_data.idempotency_key,
            carrier_name=bid_data.carrier_name,
            freight_charge=bid_data.freight_charge,
            origin_charge=bid_data.origin_charge,
            destination_charge=bid_data.destination_charge,
            total_amount=total,
            transit_time_hours=bid_data.transit_time_hours,
            valid_until=bid_data.valid_until,
            status="ACCEPTED",
            submitted_at=now,
        )
        db.add(new_bid)
        await db.flush()

        # 9. Get NEW rankings
        new_rankings = await get_rankings(db, auction_id)
        new_l1_supplier = new_rankings[0][0] if new_rankings else None
        new_l1_amount = new_rankings[0][1] if new_rankings else None

        # 10. Determine rank changes
        old_supplier_order = [r[0] for r in old_rankings]
        new_supplier_order = [r[0] for r in new_rankings]
        any_rank_changed = old_supplier_order != new_supplier_order
        l1_changed = (old_l1_supplier != new_l1_supplier) or (
            old_l1_amount != new_l1_amount
        )
        if not old_rankings and new_rankings:
            l1_changed = True

        # 11. Evaluate extension triggers
        config_result = await db.execute(
            select(AuctionConfiguration).where(
                AuctionConfiguration.auction_id == auction_id
            )
        )
        config = config_result.scalar_one()

        trigger_window_start = auction.current_close_at - timedelta(
            minutes=config.trigger_window_minutes
        )
        in_trigger_window = trigger_window_start <= now < auction.current_close_at

        should_extend = False
        matched: list[str] = []

        if in_trigger_window:
            if config.trigger_bid_received:
                should_extend = True
                matched.append("BID_RECEIVED")
            if config.trigger_any_rank_change and any_rank_changed:
                should_extend = True
                matched.append("ANY_RANK_CHANGE")
            if config.trigger_l1_change and l1_changed:
                should_extend = True
                matched.append("L1_CHANGE")

        # 12. Apply extension if needed
        extension_broadcast_payload = None
        if should_extend:
            previous_close = auction.current_close_at
            new_close = min(
                auction.current_close_at + timedelta(minutes=config.extension_minutes),
                auction.forced_close_at,
            )
            if new_close > auction.current_close_at:
                auction.current_close_at = new_close
                auction.version += 1

                extension = AuctionExtension(
                    auction_id=auction_id,
                    triggering_bid_id=new_bid.id,
                    previous_close_at=previous_close,
                    new_close_at=new_close,
                    reason=", ".join(matched),
                    matched_triggers=matched,
                    extended_at=now,
                )
                db.add(extension)

                # Activity: extension
                time_str = new_close.strftime("%I:%M %p")
                reasons = []
                if "L1_CHANGE" in matched:
                    reasons.append("new lowest quote (L1)")
                elif "ANY_RANK_CHANGE" in matched:
                    reasons.append("carrier rank change")
                elif "BID_RECEIVED" in matched:
                    reasons.append("competitive bid")
                reason_str = " & ".join(reasons) if reasons else "competitive bidding"

                db.add(
                    AuctionActivity(
                        auction_id=auction_id,
                        actor_user_id=supplier_id,
                        event_type="AUCTION_EXTENDED",
                        description=f"Closing extended to {time_str} due to {reason_str}",
                        metadata_json={
                            "previous_close": previous_close.isoformat(),
                            "new_close": new_close.isoformat(),
                            "triggers": matched,
                        },
                    )
                )

                # Prepare payload for post-commit broadcast
                extension_broadcast_payload = {
                    "type": "AUCTION_EXTENDED",
                    "previous_close_at": previous_close.isoformat(),
                    "new_close_at": new_close.isoformat(),
                    "triggers": matched,
                    "version": auction.version,
                }

        # 13. Activity: bid accepted
        db.add(
            AuctionActivity(
                auction_id=auction_id,
                actor_user_id=supplier_id,
                event_type="BID_ACCEPTED",
                description=f"New quote of ₹{int(total):,} submitted by carrier",
                metadata_json={
                    "bid_id": str(new_bid.id),
                    "total_amount": str(total),
                },
            )
        )
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    # 14. Determine rank of the new bid
    final_rankings = await get_rankings(db, auction_id)
    rank = None
    for idx, r in enumerate(final_rankings):
        if r[0] == supplier_id:
            rank = idx + 1
            break

    # 15. Post-commit WebSocket broadcasts (Guarantees zero-race reads for clients)
    if extension_broadcast_payload:
        await manager.broadcast_to_auction(auction_id, extension_broadcast_payload)

    await manager.broadcast_to_auction(
        auction_id,
        {
            "type": "NEW_BID",
            "bid_id": str(new_bid.id),
            "supplier_id": str(supplier_id),
            "total_amount": str(total),
            "rank": rank,
        },
    )

    return BidResponse(
        id=new_bid.id,
        auction_id=new_bid.auction_id,
        supplier_id=new_bid.supplier_id,
        carrier_name=new_bid.carrier_name,
        freight_charge=new_bid.freight_charge,
        origin_charge=new_bid.origin_charge,
        destination_charge=new_bid.destination_charge,
        total_amount=new_bid.total_amount,
        transit_time_hours=new_bid.transit_time_hours,
        valid_until=new_bid.valid_until,
        status=new_bid.status,
        submitted_at=new_bid.submitted_at,
        rank=rank,
    )
