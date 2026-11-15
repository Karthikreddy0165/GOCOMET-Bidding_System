import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { AuctionListItem } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { CountdownTimer } from '../components/CountdownTimer';
import { format } from 'date-fns';

export const AuctionListPage: React.FC = () => {
  const { user } = useAuth();
  const [auctions, setAuctions] = useState<AuctionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'CLOSED'>('ALL');

  const fetchAuctions = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await apiClient.get<AuctionListItem[]>('/auctions/');
      setAuctions(res.data);
    } catch (err) {
      console.error('Failed to fetch auctions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuctions();
    const interval = setInterval(() => fetchAuctions(true), 5000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (val: string | number | null) => {
    if (val === null || val === undefined) return 'No quotes yet';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const activeCount = auctions.filter((a) => a.status === 'ACTIVE' || a.status === 'SCHEDULED').length;
  const closedCount = auctions.filter((a) => a.status === 'CLOSED' || a.status === 'FORCE_CLOSED').length;

  // Filtered auctions based on search and status
  const filteredAuctions = auctions.filter((auction) => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      (auction.rfq_name || '').toLowerCase().includes(term) ||
      (auction.rfq_reference || '').toLowerCase().includes(term);

    if (!matchesSearch) return false;

    if (statusFilter === 'ACTIVE') {
      return auction.status === 'ACTIVE' || auction.status === 'SCHEDULED';
    }
    if (statusFilter === 'CLOSED') {
      return auction.status === 'CLOSED' || auction.status === 'FORCE_CLOSED';
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Logistics British Auctions
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Active freight procurement RFQs with dynamic reverse bidding.
          </p>
        </div>

        {user?.role === 'BUYER' && (
          <Link
            to="/rfqs/create"
            className="px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-xs transition-colors"
          >
            + Create RFQ
          </Link>
        )}
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-3 gap-3 max-w-lg">
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`text-left bg-white border rounded-md p-3 shadow-xs transition-all ${
            statusFilter === 'ALL' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total RFQs</p>
          <p className="text-lg font-bold text-slate-900 mt-0.5 font-mono">{auctions.length}</p>
        </button>
        <button
          onClick={() => setStatusFilter('ACTIVE')}
          className={`text-left bg-white border rounded-md p-3 shadow-xs transition-all ${
            statusFilter === 'ACTIVE' ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Active Bidding</p>
          <p className="text-lg font-bold text-emerald-700 mt-0.5 font-mono">{activeCount}</p>
        </button>
        <button
          onClick={() => setStatusFilter('CLOSED')}
          className={`text-left bg-white border rounded-md p-3 shadow-xs transition-all ${
            statusFilter === 'CLOSED' ? 'border-slate-500 ring-1 ring-slate-500' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Concluded</p>
          <p className="text-lg font-bold text-slate-700 mt-0.5 font-mono">{closedCount}</p>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg p-2.5 shadow-xs">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search auctions by name, RFQ reference (e.g. RFQ-123456)..."
            className="w-full pl-3 pr-8 py-1.5 text-xs text-slate-800 placeholder-slate-400 border border-slate-200 rounded-md focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <span className="text-[11px] text-slate-400 font-medium mr-1">Status:</span>
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              statusFilter === 'ALL'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-slate-600 hover:text-slate-900 border border-transparent'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              statusFilter === 'ACTIVE'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'text-slate-600 hover:text-slate-900 border border-transparent'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setStatusFilter('CLOSED')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              statusFilter === 'CLOSED'
                ? 'bg-slate-100 text-slate-800 border border-slate-300'
                : 'text-slate-600 hover:text-slate-900 border border-transparent'
            }`}
          >
            Concluded
          </button>
        </div>
      </div>

      {/* Main Listing Content */}
      {isLoading ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center shadow-xs">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-slate-500 font-medium">Loading auctions...</p>
        </div>
      ) : auctions.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center shadow-xs">
          <p className="text-sm font-semibold text-slate-800">No Auctions Available</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            {user?.role === 'BUYER'
              ? 'You have not configured any British Auctions yet.'
              : 'You have not been invited to any active auctions yet.'}
          </p>
          {user?.role === 'BUYER' && (
            <Link
              to="/rfqs/create"
              className="inline-block px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 shadow-xs"
            >
              Create New RFQ
            </Link>
          )}
        </div>
      ) : filteredAuctions.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center shadow-xs">
          <p className="text-sm font-semibold text-slate-800">No Matching Auctions Found</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-3">
            No auctions matched &ldquo;{searchTerm}&rdquo; under the {statusFilter.toLowerCase()} filter.
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('ALL');
            }}
            className="px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 rounded hover:bg-blue-50"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredAuctions.map((auction) => (
            <Link
              key={auction.id}
              to={`/auctions/${auction.id}`}
              className="group bg-white border border-slate-200 hover:border-blue-400 rounded-lg p-4 shadow-xs transition-all block"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                {/* Left: RFQ Identifier & Route */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {auction.rfq_reference || 'RFQ-REF'}
                    </span>
                    <StatusBadge status={auction.status} size="sm" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {auction.rfq_name || 'Freight Haulage Auction'}
                  </h3>
                  <div className="text-xs text-slate-500 flex items-center gap-3">
                    <span>
                      Closing:{' '}
                      <strong className="text-slate-700 font-mono font-medium">
                        {format(new Date(auction.current_close_at), 'hh:mm a, dd MMM')}
                      </strong>
                    </span>

                    {/* ONLY BUYER SEES FORCED CLOSE LIMIT */}
                    {user?.role === 'BUYER' && auction.forced_close_at && (
                      <span className="text-slate-400">
                        · Safeguard Limit:{' '}
                        <strong className="text-slate-600 font-mono font-normal">
                          {format(new Date(auction.forced_close_at), 'hh:mm a')}
                        </strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Leading Quote & Live Timer */}
                <div className="flex sm:flex-col items-end justify-between sm:justify-center w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Best Landed Quote (L1)
                    </p>
                    <p className="text-sm font-mono font-bold text-slate-900">
                      {formatCurrency(auction.current_lowest_bid)}
                    </p>
                  </div>
                  <div className="mt-1">
                    <CountdownTimer
                      targetDate={auction.current_close_at}
                      size="sm"
                    />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
