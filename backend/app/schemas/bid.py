from datetime import datetime
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel, Field


class BidSubmit(BaseModel):
    idempotency_key: UUID
    carrier_name: str | None = None
    freight_charge: Decimal = Field(..., ge=0)
    origin_charge: Decimal = Field(..., ge=0)
    destination_charge: Decimal = Field(..., ge=0)
    transit_time_hours: int | None = None
    valid_until: datetime | None = None


class BidResponse(BaseModel):
    id: UUID
    auction_id: UUID
    supplier_id: UUID
    supplier_name: str | None = None
    carrier_name: str | None = None
    freight_charge: Decimal
    origin_charge: Decimal
    destination_charge: Decimal
    total_amount: Decimal
    transit_time_hours: int | None = None
    valid_until: datetime | None = None
    status: str
    submitted_at: datetime
    rank: int | None = None

    model_config = {"from_attributes": True}
