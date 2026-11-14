import uuid

from sqlalchemy import Column, Integer, Boolean, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class AuctionConfiguration(Base):
    __tablename__ = "auction_configurations"
    __table_args__ = (
        CheckConstraint(
            "trigger_window_minutes > 0", name="ck_trigger_window_positive"
        ),
        CheckConstraint(
            "extension_minutes > 0", name="ck_extension_minutes_positive"
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    auction_id = Column(
        UUID(as_uuid=True), ForeignKey("auctions.id"), unique=True, nullable=False
    )
    trigger_window_minutes = Column(Integer, nullable=False)
    extension_minutes = Column(Integer, nullable=False)
    trigger_bid_received = Column(Boolean, default=False, nullable=False)
    trigger_any_rank_change = Column(Boolean, default=False, nullable=False)
    trigger_l1_change = Column(Boolean, default=False, nullable=False)

    # Relationships
    auction = relationship("Auction", back_populates="config", lazy="selectin")

    def __repr__(self) -> str:
        return f"<AuctionConfiguration auction_id={self.auction_id}>"
