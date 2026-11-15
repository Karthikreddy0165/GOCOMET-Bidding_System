import React from 'react';
import { BidRankItem } from '../types';
import { format } from 'date-fns';

interface LeaderboardProps {
  bids: BidRankItem[];
  currentUserId?: string;
  isBuyer?: boolean;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ bids, currentUserId, isBuyer = false }) => {
  // Sort bids by rank ascending (lowest price first, then fastest transit)
  const sortedBids = [...bids].sort((a, b) => a.rank - b.rank);

  const formatCurrency = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(num);
  };

  if (sortedBids.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center shadow-xs">
        <p className="text-sm font-semibold text-slate-700">No Quotes Submitted Yet</p>
        <p className="text-xs text-slate-500 mt-1">
          Suppliers will appear on the live leaderboard ranked by total cost and transit time.
        </p>
      </div>
    );
  }

  const l1Bid = sortedBids[0];

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
      {/* Table Header Strip */}
      <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50/70">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Live Supplier Leaderboard</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Ranked by landed quote; faster transit breaks price ties. <strong className="text-slate-700 font-medium">L1</strong> = Lowest Quote (Current Winner), <strong className="text-slate-700 font-medium">L2</strong> = Second Lowest.
          </p>
        </div>

        {l1Bid && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Leading (L1):</span>
            <span className="font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
              {formatCurrency(l1Bid.total_amount)}
            </span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th className="px-3.5 py-2.5 text-center w-14">Rank</th>
              <th className="px-3.5 py-2.5">Supplier / Fleet</th>
              <th className="px-3.5 py-2.5 text-center">Transit</th>
              <th className="px-3.5 py-2.5 text-right">Freight</th>
              <th className="px-3.5 py-2.5 text-right">Origin / Dest</th>
              <th className="px-3.5 py-2.5 text-right font-bold text-slate-900">Total Landed Quote</th>
              <th className="px-3.5 py-2.5 text-center">Quote Validity</th>
              <th className="px-3.5 py-2.5 text-right">Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedBids.map((b) => {
              const isMe = b.supplier_id === currentUserId;
              const isL1 = b.rank === 1;

              return (
                <tr
                  key={b.id}
                  className={`transition-colors ${
                    isL1
                      ? 'bg-emerald-50/30 hover:bg-emerald-50/50'
                      : isMe
                      ? 'bg-blue-50/30 hover:bg-blue-50/50'
                      : 'hover:bg-slate-50/60'
                  }`}
                >
                  {/* Rank Badge */}
                  <td className="px-3.5 py-2.5 text-center">
                    <span
                      title={
                        isL1
                          ? 'L1: Lowest Qualified Quote (Current Winning Bid)'
                          : `L${b.rank}: Rank #${b.rank} Quote`
                      }
                      className={`inline-block font-mono font-bold px-2 py-0.5 rounded text-xs ${
                        isL1
                          ? 'bg-emerald-600 text-white'
                          : b.rank === 2
                          ? 'bg-slate-200 text-slate-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isL1 ? 'L1 (Winner)' : `L${b.rank}`}
                    </span>
                  </td>

                  {/* Supplier Info */}
                  <td className="px-3.5 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-900">
                        {isBuyer || isMe ? b.supplier_name || 'Supplier' : 'Verified Supplier'}
                      </span>
                      {isMe && (
                        <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1 py-0.2 rounded font-sans">
                          YOU
                        </span>
                      )}
                    </div>
                    {b.carrier_name && (
                      <span className="text-[11px] text-slate-500 block">{b.carrier_name}</span>
                    )}
                  </td>

                  {/* Transit Time */}
                  <td className="px-3.5 py-2.5 text-center text-slate-600 font-mono">
                    {b.transit_time_hours ? `${b.transit_time_hours}h` : '—'}
                  </td>

                  {/* Freight */}
                  <td className="px-3.5 py-2.5 text-right font-mono text-slate-700">
                    {formatCurrency(b.freight_charge)}
                  </td>

                  {/* Origin & Dest */}
                  <td className="px-3.5 py-2.5 text-right font-mono text-[11px] text-slate-500">
                    {formatCurrency(Number(b.origin_charge) + Number(b.destination_charge))}
                  </td>

                  {/* Total Quote */}
                  <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900">
                    {formatCurrency(b.total_amount)}
                  </td>

                  {/* Quote Validity */}
                  <td className="px-3.5 py-2.5 text-center text-slate-500 font-mono text-[11px]">
                    {b.valid_until ? format(new Date(b.valid_until), 'dd MMM yyyy') : '—'}
                  </td>

                  {/* Submitted Timestamp */}
                  <td className="px-3.5 py-2.5 text-right text-slate-500 font-mono text-[11px]">
                    {format(new Date(b.submitted_at), 'hh:mm:ss a')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
