from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


class RFQCreate(BaseModel):
    reference: str = Field(..., min_length=1, max_length=80)
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    pickup_service_at: datetime | None = None


class RFQResponse(BaseModel):
    id: UUID
    reference: str
    name: str
    description: str | None
    pickup_service_at: datetime | None
    status: str
    buyer_id: UUID
    created_at: datetime
    updated_at: datetime | None

    model_config = {"from_attributes": True}
