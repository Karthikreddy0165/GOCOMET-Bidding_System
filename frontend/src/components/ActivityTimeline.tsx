import React from 'react';
import { AuctionActivity } from '../types';
import { format } from 'date-fns';

interface ActivityTimelineProps {
  activities: AuctionActivity[];
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ activities }) => {
  if (activities.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-5 text-center text-slate-500 text-xs shadow-xs">
        No audit activity recorded yet.
      </div>
    );
  }

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'AUCTION_EXTENDED':
        return 'text-amber-800 bg-amber-50 border-amber-200';
      case 'BID_ACCEPTED':
        return 'text-emerald-800 bg-emerald-50 border-emerald-200';
      case 'AUCTION_CLOSED':
        return 'text-slate-700 bg-slate-100 border-slate-200';
      default:
        return 'text-blue-800 bg-blue-50 border-blue-200';
    }
  };

  const formatSingleLineDescription = (activity: AuctionActivity): string => {
    // AUCTION_EXTENDED: Format into a concise, readable single line
    if (activity.event_type === 'AUCTION_EXTENDED') {
      const meta = activity.metadata_json;
      if (meta?.new_close) {
        try {
          const closeTime = format(new Date(meta.new_close), 'hh:mm a');
          const triggers = meta.triggers || [];
          const reason = triggers.includes('L1_CHANGE')
            ? 'new lowest quote (L1)'
            : triggers.includes('ANY_RANK_CHANGE')
            ? 'supplier rank change'
            : 'late bid';
          return `Closing extended to ${closeTime} due to ${reason}.`;
        } catch {}
      }

      // Check for legacy description: "Auction extended from ... to 2026-11-15T18:38:00..."
      const match = activity.description.match(/to\s+([0-9T:+-.]+)/i);
      if (match && match[1]) {
        try {
          const closeTime = format(new Date(match[1]), 'hh:mm a');
          const reason = activity.description.includes('L1_CHANGE')
            ? 'new lowest quote (L1)'
            : 'competitive bidding';
          return `Closing extended to ${closeTime} due to ${reason}.`;
        } catch {}
      }
      return activity.description;
    }

    // BID_ACCEPTED
    if (activity.event_type === 'BID_ACCEPTED') {
      const meta = activity.metadata_json;
      const amount = meta?.total_amount || activity.description.match(/total\s+([0-9.]+)/i)?.[1];
      if (amount) {
        const formatted = new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 0,
        }).format(parseFloat(amount));
        return `Supplier placed a quote of ${formatted}.`;
      }
      return 'Supplier submitted a new quote.';
    }

    // AUCTION_CREATED
    if (activity.event_type === 'AUCTION_CREATED') {
      return 'RFQ auction created and opened for bidding.';
    }

    // AUCTION_CLOSED
    if (activity.event_type === 'AUCTION_CLOSED') {
      return 'Auction concluded. Final winner determined at L1 quote.';
    }

    return activity.description;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-slate-100 mb-3 gap-1.5">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Audit & Activity Log</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Key: <strong className="text-slate-600 font-medium">L1</strong> = Lowest Quote (Rank 1 / Winner) ·{' '}
            <strong className="text-slate-600 font-medium">L2</strong> = Second Lowest
          </p>
        </div>
        <span className="text-[11px] text-slate-400 font-mono">{activities.length} entries</span>
      </div>

      <div className="flow-root max-h-[300px] overflow-y-auto pr-1">
        <ul className="divide-y divide-slate-100">
          {activities.map((activity) => (
            <li key={activity.id} className="py-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${getEventBadge(
                    activity.event_type
                  )}`}
                >
                  {activity.event_type === 'AUCTION_EXTENDED'
                    ? 'Extended'
                    : activity.event_type === 'BID_ACCEPTED'
                    ? 'Quote'
                    : activity.event_type === 'AUCTION_CLOSED'
                    ? 'Closed'
                    : 'Event'}
                </span>
                <span className="text-xs text-slate-700 truncate" title={activity.description}>
                  {formatSingleLineDescription(activity)}
                </span>
              </div>
              <time className="text-[11px] font-mono text-slate-400 shrink-0">
                {format(new Date(activity.created_at), 'hh:mm:ss a')}
              </time>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
