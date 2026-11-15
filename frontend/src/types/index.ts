export type UserRole = 'BUYER' | 'SUPPLIER';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface RFQ {
  id: string;
  reference: string;
  name: string;
  description: string | null;
  pickup_service_at: string;
  status: string;
  buyer_id: string;
  created_at: string;
  updated_at: string;
}

export interface AuctionConfiguration {
  id: string;
  auction_id: string;
  trigger_window_minutes: number;
  extension_minutes: number;
  trigger_bid_received: boolean;
  trigger_any_rank_change: boolean;
  trigger_l1_change: boolean;
}

export interface SupplierInfo {
  id: string;
  supplier_id: string;
  status: string;
  supplier_name: string | null;
  supplier_email: string | null;
  invited_at: string;
  joined_at: string | null;
}

export interface ExtensionInfo {
  id: string;
  auction_id: string;
  triggering_bid_id: string | null;
  previous_close_at: string;
  new_close_at: string;
  reason: string | null;
  matched_triggers: string[] | null;
  extended_at: string;
}

export interface BidRankItem {
  id: string;
  auction_id: string;
  supplier_id: string;
  supplier_name: string | null;
  carrier_name: string | null;
  freight_charge: string | number;
  origin_charge: string | number;
  destination_charge: string | number;
  total_amount: string | number;
  transit_time_hours: number | null;
  valid_until: string | null;
  status: string;
  submitted_at: string;
  rank: number;
}

export interface AuctionListItem {
  id: string;
  rfq_id: string;
  rfq_name: string | null;
  rfq_reference: string | null;
  current_lowest_bid: string | number | null;
  current_close_at: string;
  forced_close_at: string | null; // Only visible to BUYER
  status: 'ACTIVE' | 'SCHEDULED' | 'CLOSED' | 'FORCE_CLOSED';
}

export interface AuctionDetail {
  id: string;
  rfq_id: string;
  rfq_name: string | null;
  rfq_reference: string | null;
  start_at: string;
  scheduled_close_at: string;
  current_close_at: string;
  forced_close_at: string | null; // Only visible to BUYER
  status: 'ACTIVE' | 'SCHEDULED' | 'CLOSED' | 'FORCE_CLOSED';
  version: number;
  created_at: string;
  config: AuctionConfiguration | null;
  suppliers: SupplierInfo[];
  bids: BidRankItem[];
  extensions: ExtensionInfo[];
}

export interface AuctionActivity {
  id: string;
  auction_id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  event_type: string;
  description: string;
  metadata_json: Record<string, any> | null;
  created_at: string;
}

