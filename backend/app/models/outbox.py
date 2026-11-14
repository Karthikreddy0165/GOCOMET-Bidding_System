import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, Integer, JSON
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class OutboxEvent(Base):
    __tablename__ = "outbox_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type = Column(String(80), nullable=False)
    aggregate_type = Column(String(40), nullable=True)
    aggregate_id = Column(UUID(as_uuid=True), nullable=True)
    payload = Column(JSON, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    published_at = Column(DateTime(timezone=True), nullable=True)
    attempts = Column(Integer, default=0, nullable=False)

    def __repr__(self) -> str:
        return f"<OutboxEvent {self.event_type} aggregate={self.aggregate_type}:{self.aggregate_id}>"
