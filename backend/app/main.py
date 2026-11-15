import asyncio
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import select, update

from app.database import engine, Base, async_session_factory
from app.models.auction import Auction
from app.models.activity import AuctionActivity
from app.websocket.manager import manager
from app.routers import auth, rfqs, auctions, bids, activity, demo
from app.websocket import handlers as ws_handlers

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def background_auction_closer():
    """
    Background worker that checks for expired auctions every 5 seconds
    and transitions them to CLOSED or FORCE_CLOSED, broadcasting via WebSocket.
    """
    while True:
        try:
            await asyncio.sleep(5)
            now = datetime.now(timezone.utc)
            async with async_session_factory() as session:
                result = await session.execute(
                    select(Auction).where(
                        Auction.status == "ACTIVE",
                        Auction.current_close_at <= now,
                    )
                )
                overdue_auctions = result.scalars().all()

                for auction in overdue_auctions:
                    new_status = "FORCE_CLOSED" if now >= auction.forced_close_at else "CLOSED"
                    auction.status = new_status
                    auction.version += 1

                    activity_entry = AuctionActivity(
                        auction_id=auction.id,
                        actor_user_id=None,
                        event_type="AUCTION_CLOSED",
                        description=f"Auction automatically {new_status.lower().replace('_', ' ')} as scheduled close time reached",
                        metadata_json={"final_status": new_status, "closed_at": now.isoformat()},
                    )
                    session.add(activity_entry)
                    await session.commit()

                    logger.info(f"Auction {auction.id} marked as {new_status}")

                    # Broadcast closure to connected WebSockets
                    await manager.broadcast_to_auction(
                        auction.id,
                        {
                            "type": "AUCTION_CLOSED",
                            "auction_id": str(auction.id),
                            "status": new_status,
                            "closed_at": now.isoformat(),
                            "version": auction.version,
                        },
                    )
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Error in background auction closer: {e}", exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database schema verified/created.")

    # Start background closer task
    closer_task = asyncio.create_task(background_auction_closer())
    yield
    closer_task.cancel()
    try:
        await closer_task
    except asyncio.CancelledError:
        pass
    await engine.dispose()


app = FastAPI(
    title="British Auction RFQ System API",
    description="Backend API for Logistics RFQ British Auction reverse bidding with dynamic time extensions",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(rfqs.router)
app.include_router(auctions.router)
app.include_router(bids.router)
app.include_router(activity.router)
app.include_router(demo.router)
app.include_router(ws_handlers.router)


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "british-auction-rfq-api",
    }


# Static Frontend Serving & Single Page App Fallback (Production / Docker)
static_dir = os.environ.get("STATIC_DIR", "/app/static")
if not os.path.exists(static_dir):
    local_dist = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")
    if os.path.exists(local_dist):
        static_dir = local_dist

if os.path.exists(static_dir):
    assets_dir = os.path.join(static_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        if full_path.startswith((
            "docs", "redoc", "openapi.json", "auth", "rfqs", "auctions",
            "bids", "activity", "demo", "ws", "health"
        )):
            raise HTTPException(status_code=404, detail="Not Found")
        target_file = os.path.join(static_dir, full_path)
        if os.path.exists(target_file) and os.path.isfile(target_file):
            return FileResponse(target_file)
        index_file = os.path.join(static_dir, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Static index not found")

