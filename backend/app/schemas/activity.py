from datetime import datetime
from uuid import UUID
from typing import Any
from pydantic import BaseModel


class ActivityResponse(BaseModel):
    id: UUID
    auction_id: UUID
    actor_user_id: UUID | None
    actor_name: str | None = None
    event_type: str
    description: str | None
    metadata: Any | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
