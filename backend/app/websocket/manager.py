import json
import logging
from uuid import UUID

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections grouped by auction_id."""

    def __init__(self) -> None:
        self.active_connections: dict[UUID, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, auction_id: UUID) -> None:
        """Accept a WebSocket connection and add it to the auction room."""
        await websocket.accept()
        if auction_id not in self.active_connections:
            self.active_connections[auction_id] = []
        self.active_connections[auction_id].append(websocket)
        logger.info(
            f"WebSocket connected to auction {auction_id}. "
            f"Total connections: {len(self.active_connections[auction_id])}"
        )

    def disconnect(self, websocket: WebSocket, auction_id: UUID) -> None:
        """Remove a WebSocket connection from the auction room."""
        if auction_id in self.active_connections:
            if websocket in self.active_connections[auction_id]:
                self.active_connections[auction_id].remove(websocket)
            if not self.active_connections[auction_id]:
                del self.active_connections[auction_id]
        logger.info(f"WebSocket disconnected from auction {auction_id}")

    async def broadcast_to_auction(
        self, auction_id: UUID, message: dict
    ) -> None:
        """Broadcast a JSON message to all connections in an auction room."""
        if auction_id not in self.active_connections:
            return

        disconnected: list[WebSocket] = []
        for connection in self.active_connections[auction_id]:
            try:
                await connection.send_text(json.dumps(message, default=str))
            except Exception:
                disconnected.append(connection)

        # Clean up disconnected clients
        for conn in disconnected:
            self.disconnect(conn, auction_id)

    async def send_personal(
        self, websocket: WebSocket, message: dict
    ) -> None:
        """Send a JSON message to a specific WebSocket connection."""
        try:
            await websocket.send_text(json.dumps(message, default=str))
        except Exception:
            logger.warning("Failed to send personal message via WebSocket")


# Singleton instance
manager = ConnectionManager()
