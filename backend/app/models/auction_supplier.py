import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class AuctionSupplier(Base):
    __tablename__ = "auction_suppliers"
    __table_args__ = (
        UniqueConstraint("auction_id", "supplier_id", name="uq_auction_supplier"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    auction_id = Column(
        UUID(as_uuid=True), ForeignKey("auctions.id"), nullable=False, index=True
    )
    supplier_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    status = Column(String(20), default="INVITED", nullable=False)
    invited_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    joined_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    auction = relationship("Auction", back_populates="suppliers", lazy="selectin")
    supplier = relationship("User", back_populates="auction_suppliers", lazy="selectin")

    def __repr__(self) -> str:
        return f"<AuctionSupplier auction={self.auction_id} supplier={self.supplier_id}>"
