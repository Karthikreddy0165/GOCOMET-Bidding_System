import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, BigInteger, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Auction(Base):
    __tablename__ = "auctions"
    __table_args__ = (
        CheckConstraint(
            "forced_close_at > scheduled_close_at",
            name="ck_forced_after_scheduled",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rfq_id = Column(
        UUID(as_uuid=True), ForeignKey("rfqs.id"), unique=True, nullable=False
    )
    start_at = Column(DateTime(timezone=True), nullable=False)
    scheduled_close_at = Column(DateTime(timezone=True), nullable=False)
    current_close_at = Column(DateTime(timezone=True), nullable=False)
    forced_close_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), default="SCHEDULED", nullable=False)
    version = Column(BigInteger, default=0, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=True,
    )

    # Relationships
    rfq = relationship("RFQ", back_populates="auction", lazy="selectin")
    config = relationship(
        "AuctionConfiguration", back_populates="auction", uselist=False, lazy="selectin"
    )
    suppliers = relationship("AuctionSupplier", back_populates="auction", lazy="selectin")
    bids = relationship("Bid", back_populates="auction", lazy="selectin")
    extensions = relationship("AuctionExtension", back_populates="auction", lazy="selectin")
    activities = relationship("AuctionActivity", back_populates="auction", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Auction {self.id} status={self.status}>"
