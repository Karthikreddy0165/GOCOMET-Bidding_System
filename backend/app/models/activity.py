import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class AuctionActivity(Base):
    __tablename__ = "auction_activities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    auction_id = Column(
        UUID(as_uuid=True), ForeignKey("auctions.id"), nullable=False, index=True
    )
    actor_user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    event_type = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    metadata_json = Column("metadata", JSON, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    auction = relationship("Auction", back_populates="activities", lazy="selectin")
    actor = relationship("User", lazy="selectin")

    def __repr__(self) -> str:
        return f"<AuctionActivity {self.event_type}>"
