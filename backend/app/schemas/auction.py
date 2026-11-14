from datetime import datetime
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel, Field


class AuctionConfigCreate(BaseModel):
    trigger_window_minutes: int = Field(..., gt=0)
    extension_minutes: int = Field(..., gt=0)
    trigger_bid_received: bool = False
    trigger_any_rank_change: bool = False
    trigger_l1_change: bool = False


class AuctionConfigResponse(BaseModel):
    id: UUID
    auction_id: UUID
    trigger_window_minutes: int
    extension_minutes: int
    trigger_bid_received: bool
    trigger_any_rank_change: bool
    trigger_l1_change: bool

    model_config = {"from_attributes": True}


class AuctionCreate(BaseModel):
    start_at: datetime
    scheduled_close_at: datetime
    forced_close_at: datetime
    config: AuctionConfigCreate


class AuctionResponse(BaseModel):
    id: UUID
    rfq_id: UUID
    start_at: datetime
    scheduled_close_at: datetime
    current_close_at: datetime
    forced_close_at: datetime
    status: str
    version: int
    created_at: datetime

    model_config = {"from_attributes": True}


class SupplierInfo(BaseModel):
    id: UUID
    supplier_id: UUID
    status: str
    supplier_name: str | None = None
    supplier_email: str | None = None
    invited_at: datetime
    joined_at: datetime | None = None

    model_config = {"from_attributes": True}


class ExtensionInfo(BaseModel):
    id: UUID
    auction_id: UUID
    triggering_bid_id: UUID | None
    previous_close_at: datetime
    new_close_at: datetime
    reason: str | None
    matched_triggers: list[str] | None
    extended_at: datetime

    model_config = {"from_attributes": True}


class BidRankItem(BaseModel):
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
    rank: int

    model_config = {"from_attributes": True}


class AuctionListItem(BaseModel):
    id: UUID
    rfq_id: UUID
    rfq_name: str | None = None
    rfq_reference: str | None = None
    current_lowest_bid: Decimal | None = None
    current_close_at: datetime
    forced_close_at: datetime | None = None
    status: str

    model_config = {"from_attributes": True}


class AuctionDetailResponse(BaseModel):
    id: UUID
    rfq_id: UUID
    rfq_name: str | None = None
    rfq_reference: str | None = None
    start_at: datetime
    scheduled_close_at: datetime
    current_close_at: datetime
    forced_close_at: datetime | None = None
    status: str
    version: int
    created_at: datetime
    config: AuctionConfigResponse | None = None
    suppliers: list[SupplierInfo] = []
    bids: list[BidRankItem] = []
    extensions: list[ExtensionInfo] = []

    model_config = {"from_attributes": True}


class SupplierInvite(BaseModel):
    supplier_ids: list[UUID]
