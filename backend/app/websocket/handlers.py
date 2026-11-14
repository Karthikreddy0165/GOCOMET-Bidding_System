import logging
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import JWTError
from sqlalchemy import select

from app.database import async_session_factory
from app.models.auction import Auction
from app.models.bid import Bid
from app.models.user import User
from app.services.auth_service import decode_access_token
from app.services.ranking_service import get_rankings
from app.websocket.manager import manager

logger = logging.getLogger(__name__)

router = APIRouter()


async def authenticate_ws(token: str) -> User | None:
    """Authenticate a WebSocket connection via JWT token."""
    try:
        payload = decode_access_token(token)
        user_id_str = payload.get("sub")
        if not user_id_str:
            return None
        user_id = UUID(user_id_str)
    except (JWTError, ValueError):
        return None

    async with async_session_factory() as session:
        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user and user.is_active:
            return user
    return None


async def build_auction_snapshot(auction_id: UUID, role: str = "SUPPLIER") -> dict:
    """Build a snapshot of the current auction state."""
    async with async_session_factory() as session:
        result = await session.execute(
            select(Auction).where(Auction.id == auction_id)
        )
        auction = result.scalar_one_or_none()
        if not auction:
            return {"type": "ERROR", "message": "Auction not found"}

        rankings = await get_rankings(session, auction_id)
        ranking_list = []
        for idx, r in enumerate(rankings):
            user_result = await session.execute(
                select(User).where(User.id == r[0])
            )
            user = user_result.scalar_one_or_none()
            ranking_list.append(
                {
                    "rank": idx + 1,
                    "supplier_id": str(r[0]),
                    "supplier_name": user.full_name if user else None,
                    "best_total": str(r[1]),
                }
            )

        return {
            "type": "AUCTION_SNAPSHOT",
            "auction_id": str(auction.id),
            "status": auction.status,
            "current_close_at": auction.current_close_at.isoformat(),
            "forced_close_at": auction.forced_close_at.isoformat() if role == "BUYER" else None,
            "version": auction.version,
            "rankings": ranking_list,
        }


@router.websocket("/ws/{auction_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    auction_id: UUID,
    token: str = Query(...),
) -> None:
    """
    WebSocket endpoint for real-time auction updates.
    Authenticate via query param `token`.
    """
    # Authenticate
    user = await authenticate_ws(token)
    if not user:
        await websocket.close(code=4001, reason="Authentication failed")
        return

    # Connect to auction room
    await manager.connect(websocket, auction_id)

    try:
        # Send initial auction snapshot
        snapshot = await build_auction_snapshot(auction_id, role=user.role)
        await manager.send_personal(websocket, snapshot)

        # Keep connection alive and handle incoming messages
        while True:
            data = await websocket.receive_text()
            # Handle ping/pong or other client messages
            if data == "ping":
                await manager.send_personal(websocket, {"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(websocket, auction_id)
        logger.info(
            f"User {user.email} disconnected from auction {auction_id}"
        )
    except Exception as e:
        manager.disconnect(websocket, auction_id)
        logger.error(f"WebSocket error: {e}")
