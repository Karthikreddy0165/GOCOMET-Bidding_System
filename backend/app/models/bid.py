import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    String,
    DateTime,
    Integer,
    Numeric,
    ForeignKey,
    UniqueConstraint,
    CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Bid(Base):
    __tablename__ = "bids"
    __table_args__ = (
        UniqueConstraint("supplier_id", "idempotency_key", name="uq_supplier_idempotency"),
        CheckConstraint("freight_charge >= 0", name="ck_freight_charge_positive"),
        CheckConstraint("origin_charge >= 0", name="ck_origin_charge_positive"),
        CheckConstraint("destination_charge >= 0", name="ck_destination_charge_positive"),
        CheckConstraint("total_amount >= 0", name="ck_total_amount_positive"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    auction_id = Column(
        UUID(as_uuid=True), ForeignKey("auctions.id"), nullable=False, index=True
    )
    supplier_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    idempotency_key = Column(UUID(as_uuid=True), nullable=False)
    carrier_name = Column(String(200), nullable=True)
    freight_charge = Column(Numeric(14, 2), nullable=False)
    origin_charge = Column(Numeric(14, 2), nullable=False)
    destination_charge = Column(Numeric(14, 2), nullable=False)
    total_amount = Column(Numeric(14, 2), nullable=False)
    transit_time_hours = Column(Integer, nullable=True)
    valid_until = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), default="ACCEPTED", nullable=False)
    submitted_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    auction = relationship("Auction", back_populates="bids", lazy="selectin")
    supplier = relationship("User", back_populates="bids", lazy="selectin")
    triggered_extensions = relationship(
        "AuctionExtension", back_populates="triggering_bid", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Bid {self.id} total={self.total_amount}>"
