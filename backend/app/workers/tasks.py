from datetime import datetime, timezone
import logging
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models.auction import Auction
from app.models.activity import AuctionActivity
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

# Synchronous engine for Celery tasks
sync_engine = create_engine(settings.DATABASE_URL_SYNC, pool_pre_ping=True)
SyncSession = sessionmaker(bind=sync_engine)


@celery_app.task
def close_overdue_auctions():
    """
    Periodic task to scan and transition auctions that have passed their
    current_close_at or forced_close_at into CLOSED or FORCE_CLOSED.
    """
    now = datetime.now(timezone.utc)
    with SyncSession() as session:
        try:
            stmt = select(Auction).where(
                Auction.status == "ACTIVE",
                Auction.current_close_at <= now,
            )
            overdue_auctions = session.execute(stmt).scalars().all()

            for auction in overdue_auctions:
                new_status = "FORCE_CLOSED" if now >= auction.forced_close_at else "CLOSED"
                auction.status = new_status
                auction.version += 1

                activity_entry = AuctionActivity(
                    auction_id=auction.id,
                    actor_user_id=None,
                    event_type="AUCTION_CLOSED",
                    description=f"Celery worker transitioned auction to {new_status}",
                    metadata_json={"final_status": new_status, "closed_at": now.isoformat()},
                )
                session.add(activity_entry)
                logger.info(f"Celery: Auction {auction.id} transitioned to {new_status}")

            session.commit()
            return f"Processed {len(overdue_auctions)} overdue auctions"
        except Exception as e:
            session.rollback()
            logger.error(f"Error closing overdue auctions in Celery: {e}", exc_info=True)
            raise

