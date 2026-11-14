import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)
    role = Column(String(20), nullable=False)  # BUYER or SUPPLIER
    full_name = Column(String(160), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    rfqs = relationship("RFQ", back_populates="buyer", lazy="selectin")
    auction_suppliers = relationship("AuctionSupplier", back_populates="supplier", lazy="selectin")
    bids = relationship("Bid", back_populates="supplier", lazy="selectin")

    def __repr__(self) -> str:
        return f"<User {self.email} ({self.role})>"
