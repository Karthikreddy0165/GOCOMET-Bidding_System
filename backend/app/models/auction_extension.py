import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class AuctionExtension(Base):
    __tablename__ = "auction_extensions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    auction_id = Column(
        UUID(as_uuid=True), ForeignKey("auctions.id"), nullable=False, index=True
    )
    triggering_bid_id = Column(
        UUID(as_uuid=True), ForeignKey("bids.id"), nullable=True
    )
    previous_close_at = Column(DateTime(timezone=True), nullable=False)
    new_close_at = Column(DateTime(timezone=True), nullable=False)
    reason = Column(String(100), nullable=True)
    matched_triggers = Column(JSON, nullable=True)
    extended_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    auction = relationship("Auction", back_populates="extensions", lazy="selectin")
    triggering_bid = relationship("Bid", back_populates="triggered_extensions", lazy="selectin")

    def __repr__(self) -> str:
        return f"<AuctionExtension auction={self.auction_id} reason={self.reason}>"
