import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { AuctionDetail, AuctionActivity, User } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { CountdownTimer } from '../components/CountdownTimer';
import { Leaderboard } from '../components/Leaderboard';
import { BidForm } from '../components/BidForm';
import { ActivityTimeline } from '../components/ActivityTimeline';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export const AuctionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, token } = useAuth();

  const [auction, setAuction] = useState<AuctionDetail | null>(null);
  const [activities, setActivities] = useState<AuctionActivity[]>([]);
  const [availableSuppliers, setAvailableSuppliers] = useState<User[]>([]);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  const fetchAuctionData = async (silent = false) => {
    if (!id) return;
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [auctionRes, activityRes] = await Promise.all([
        apiClient.get<AuctionDetail>(`/auctions/${id}`),
        apiClient.get<AuctionActivity[]>(`/auctions/${id}/activity`),
      ]);
      setAuction(auctionRes.data);
      setActivities(activityRes.data);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to load auction');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchSuppliersForBuyer = async () => {
    if (user?.role !== 'BUYER') return;
    try {
      const res = await apiClient.get<User[]>('/auth/suppliers');
      setAvailableSuppliers(res.data);
    } catch (err) {
      console.error('Failed to fetch suppliers:', err);
    }
  };

  useEffect(() => {
    if (!id || !token) return;

    fetchAuctionData();
    fetchSuppliersForBuyer();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:8000/ws/${id}?token=${token}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setIsWsConnected(true);
    ws.onclose = () => setIsWsConnected(false);
    ws.onerror = () => setIsWsConnected(false);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'NEW_BID') {
          toast.success('Live quote submitted - rankings updated');
          fetchAuctionData(true);
        } else if (data.type === 'AUCTION_EXTENDED') {
          toast.success('Active bidding has extended the closing time');
          if (data.new_close_at) {
            setAuction((prev) => (prev ? { ...prev, current_close_at: data.new_close_at } : null));
          }
          fetchAuctionData(true);
        } else if (data.type === 'AUCTION_CLOSED') {
          toast.error('Auction bidding has concluded');
          fetchAuctionData(true);
        }
      } catch (e) {
        console.error('Error parsing WS message:', e);
      }
    };

    return () => ws.close();
  }, [id, token]);

  const handleInviteSuppliers = async () => {
    if (!id || selectedSupplierIds.length === 0) return;
    setIsInviting(true);
    try {
      await apiClient.post(`/auctions/${id}/suppliers`, {
        supplier_ids: selectedSupplierIds,
      });
      toast.success('Suppliers invited successfully');
      setSelectedSupplierIds([]);
      setShowInviteModal(false);
      fetchAuctionData(true);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to invite suppliers');
    } finally {
      setIsInviting(false);
    }
  };

  const formatCurrency = (val: string | number | null) => {
    if (val === null || val === undefined) return 'No quotes yet';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(num);
  };

  if (isLoading || !auction) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-slate-500 font-medium">Loading auction details...</p>
        </div>
      </div>
    );
  }

  // Find supplier's own quote if applicable
  const myBestBid = auction.bids.find((b) => b.supplier_id === user?.id);
  const myBestBidAmount = myBestBid ? parseFloat(myBestBid.total_amount.toString()) : null;

  const isSupplierInvited =
    user?.role === 'SUPPLIER' &&
    auction.suppliers.some((s) => s.supplier_id === user.id);

  const uninvitedSuppliers = availableSuppliers.filter(
    (sup) => !auction.suppliers.some((s) => s.supplier_id === sup.id)
  );

  const l1Bid = auction.bids.length > 0 ? auction.bids[0] : null;
  const transits = auction.bids.filter((b) => b.transit_time_hours != null).map((b) => b.transit_time_hours as number);
  const fastestTransit = transits.length > 0 ? Math.min(...transits) : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Top Header / Breadcrumb Strip */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="flex items-center gap-2 text-xs">
          <Link to="/auctions" className="text-slate-500 hover:text-slate-800 font-medium">
            Auctions
          </Link>
          <span className="text-slate-300">/</span>
          <span className="font-mono font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
            {auction.rfq_reference || 'RFQ'}
          </span>
          <StatusBadge status={auction.status} size="sm" />
        </div>
      </div>

      {/* Main Information Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {auction.rfq_name || 'Freight Haulage Reverse Auction'}
            </h1>
            <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                Scheduled Close:{' '}
                <strong className="text-slate-700 font-mono font-normal">
                  {format(new Date(auction.scheduled_close_at), 'hh:mm a, dd MMM')}
                </strong>
              </span>
              <span>
                Target Close:{' '}
                <strong className="text-slate-900 font-mono font-semibold">
                  {format(new Date(auction.current_close_at), 'hh:mm a, dd MMM')}
                </strong>
              </span>
            </div>
          </div>

          {/* Countdown Timer */}
          <div>
            {auction.status === 'ACTIVE' ? (
              <CountdownTimer targetDate={auction.current_close_at} size="lg" />
            ) : (
              <span className="inline-block px-3 py-1.5 rounded-md bg-slate-100 text-slate-600 font-medium text-xs border border-slate-200">
                Bidding Concluded
              </span>
            )}
          </div>
        </div>

        {/* 4 Clean Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
          {/* Metric 1: Current Lowest Bid (L1) */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-md p-3">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Lowest Quote (L1)
            </span>
            <p className="text-lg font-bold text-slate-900 font-mono mt-0.5">
              {l1Bid ? formatCurrency(l1Bid.total_amount) : 'No quotes yet'}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
              {l1Bid
                ? user?.role === 'BUYER' || l1Bid.supplier_id === user?.id
                  ? l1Bid.supplier_name || 'Carrier'
                  : 'Leading Carrier (L1)'
                : 'Awaiting first bid'}
            </p>
          </div>

          {/* Metric 2: Fastest Transit Time */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-md p-3">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Fastest Transit Time
            </span>
            <p className="text-lg font-bold text-slate-900 font-mono mt-0.5">
              {fastestTransit ? `${fastestTransit}h` : '—'}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {fastestTransit ? 'Speed priority on price ties' : 'No transit data'}
            </p>
          </div>

          {/* Metric 3: Total Quotes */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-md p-3">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Quotes Received
            </span>
            <p className="text-lg font-bold text-slate-900 font-mono mt-0.5">
              {auction.bids.length}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Logged in reverse bidding
            </p>
          </div>

          {/* Metric 4: BUYER vs SUPPLIER Metric */}
          {user?.role === 'BUYER' ? (
            /* ONLY BUYER SEES FORCED CLOSE LIMIT */
            <div className="bg-slate-50/70 border border-slate-200 rounded-md p-3">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Safeguard Limit (Forced Close)
              </span>
              <p className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                {auction.forced_close_at
                  ? format(new Date(auction.forced_close_at), 'hh:mm a')
                  : '—'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Hard ceiling for time extensions
              </p>
            </div>
          ) : (
            /* SUPPLIER SEES THEIR BEST QUOTE & STANDING */
            <div className="bg-slate-50/70 border border-slate-200 rounded-md p-3">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Your Best Quote
              </span>
              <p className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                {myBestBidAmount ? formatCurrency(myBestBidAmount) : 'No quote submitted'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {myBestBid ? `Current Standing: Rank L${myBestBid.rank}` : 'Enter your quote below'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content: 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Left Column (2 cols) */}
        <div className="lg:col-span-2 space-y-5">
          {/* Supplier Bid Form */}
          {user?.role === 'SUPPLIER' && (
            <div>
              {isSupplierInvited ? (
                auction.status === 'ACTIVE' ? (
                  <BidForm
                    auctionId={auction.id}
                    currentBestBid={myBestBidAmount}
                    onBidSuccess={() => fetchAuctionData(true)}
                  />
                ) : (
                  <div className="bg-white border border-slate-200 rounded-lg p-4 text-center text-xs text-slate-500 shadow-xs">
                    Auction bidding has concluded.
                  </div>
                )
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600">
                  You are not currently enrolled for this specific RFQ auction.
                </div>
              )}
            </div>
          )}

          {/* Leaderboard Component */}
          <Leaderboard
            bids={auction.bids}
            currentUserId={user?.id}
            isBuyer={user?.role === 'BUYER'}
          />

          {/* Time Extension History (if any) */}
          {auction.extensions.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                Extension History ({auction.extensions.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Extended At</th>
                      <th className="px-3 py-2">Previous Close</th>
                      <th className="px-3 py-2">New Target Close</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auction.extensions.map((ext) => (
                      <tr key={ext.id}>
                        <td className="px-3 py-2 font-mono text-slate-600">
                          {format(new Date(ext.extended_at), 'hh:mm:ss a')}
                        </td>
                        <td className="px-3 py-2 text-slate-400 line-through font-mono">
                          {format(new Date(ext.previous_close_at), 'hh:mm a')}
                        </td>
                        <td className="px-3 py-2 font-bold font-mono text-slate-900">
                          {format(new Date(ext.new_close_at), 'hh:mm a')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (1 col) */}
        <div className="space-y-5">
          {/* Auction Configuration (X and Y parameters) - visible to Buyer */}
          {user?.role === 'BUYER' && auction.config && (
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Auction Configuration
                </h3>
                <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                  Admin Rules
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs mb-3">
                <div className="bg-slate-50 border border-slate-100 p-2.5 rounded">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                    Trigger Window (X)
                  </span>
                  <span className="text-base font-bold font-mono text-slate-900 block mt-0.5">
                    {auction.config.trigger_window_minutes} mins
                  </span>
                  <span className="text-[10px] text-slate-500">Monitors bids before close</span>
                </div>

                <div className="bg-slate-50 border border-slate-100 p-2.5 rounded">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                    Extension Step (Y)
                  </span>
                  <span className="text-base font-bold font-mono text-slate-900 block mt-0.5">
                    +{auction.config.extension_minutes} mins
                  </span>
                  <span className="text-[10px] text-slate-500">Added per trigger event</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-1 text-[11px] text-slate-600">
                <span className="font-semibold text-slate-700 block text-[10px] uppercase tracking-wider mb-1">
                  Active Extension Triggers:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {auction.config.trigger_bid_received && (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-medium">
                      ✓ Any Bid in Window
                    </span>
                  )}
                  {auction.config.trigger_any_rank_change && (
                    <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-medium">
                      ✓ Any Rank Change
                    </span>
                  )}
                  {auction.config.trigger_l1_change && (
                    <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded text-[10px] font-medium">
                      ✓ L1 Leader Change
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Invited Carriers Card */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Participating Carriers ({auction.suppliers.length})
              </h3>
              {user?.role === 'BUYER' && uninvitedSuppliers.length > 0 && (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  + Invite
                </button>
              )}
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {auction.suppliers.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-2 rounded-md bg-slate-50 text-xs border border-slate-100"
                >
                  <div className="truncate pr-2">
                    <p className="font-medium text-slate-800 truncate">
                      {s.supplier_name || 'Carrier'}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">{s.supplier_email}</p>
                  </div>
                  <span className="text-[10px] font-medium bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Timeline Feed */}
          <ActivityTimeline activities={activities} />
        </div>
      </div>

      {/* Invite Modal for Buyer */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-5 shadow-lg border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Invite Verified Carriers</h3>
            <p className="text-xs text-slate-500 mb-4">
              Select carriers to participate in this British Auction.
            </p>

            <div className="space-y-1.5 max-h-56 overflow-y-auto mb-4 pr-1">
              {uninvitedSuppliers.map((s) => {
                const isSelected = selectedSupplierIds.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className={`flex items-center justify-between p-2 rounded-md border text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/40'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <p className="font-medium text-slate-800">{s.full_name || s.email}</p>
                      <p className="text-[11px] text-slate-400">{s.email}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSupplierIds([...selectedSupplierIds, s.id]);
                        } else {
                          setSelectedSupplierIds(selectedSupplierIds.filter((id) => id !== s.id));
                        }
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInviteSuppliers}
                disabled={isInviting || selectedSupplierIds.length === 0}
                className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:bg-slate-300"
              >
                {isInviting ? 'Inviting...' : `Invite (${selectedSupplierIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
