import React, { useState } from 'react';
import { apiClient } from '../api/client';
import toast from 'react-hot-toast';
import { DateTimePicker } from './DateTimePicker';

interface BidFormProps {
  auctionId: string;
  currentBestBid?: number | null;
  onBidSuccess: () => void;
  disabled?: boolean;
}

export const BidForm: React.FC<BidFormProps> = ({
  auctionId,
  currentBestBid,
  onBidSuccess,
  disabled = false,
}) => {
  const [fleetName, setFleetName] = useState('');
  const [freightCharge, setFreightCharge] = useState<string>('');
  const [originCharge, setOriginCharge] = useState<string>('0');
  const [destinationCharge, setDestinationCharge] = useState<string>('0');
  const [transitTimeHours, setTransitTimeHours] = useState<string>('48');
  const [validUntil, setValidUntil] = useState<Date>(
    new Date(Date.now() + 14 * 86400000)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const freight = parseFloat(freightCharge) || 0;
  const origin = parseFloat(originCharge) || 0;
  const dest = parseFloat(destinationCharge) || 0;
  const total = freight + origin + dest;

  const isSameAsExistingQuote =
    currentBestBid !== undefined &&
    currentBestBid !== null &&
    Math.abs(total - currentBestBid) < 0.01;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (freight <= 0) {
      toast.error('Freight charge must be greater than 0');
      return;
    }

    if (isSameAsExistingQuote) {
      toast.error('You cannot submit the same quote amount you have already submitted.');
      return;
    }

    setIsSubmitting(true);
    const idempotencyKey = crypto.randomUUID();

    try {
      await apiClient.post(`/auctions/${auctionId}/bids`, {
        idempotency_key: idempotencyKey,
        carrier_name: fleetName.trim() || undefined,
        freight_charge: freight,
        origin_charge: origin,
        destination_charge: dest,
        transit_time_hours: parseInt(transitTimeHours) || null,
        valid_until: validUntil && !isNaN(validUntil.getTime()) ? validUntil.toISOString() : null,
      });

      toast.success(`Quote of ₹${total.toLocaleString('en-IN')} submitted successfully`);
      setFreightCharge('');
      onBidSuccess();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to submit quote';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Submit Supplier Quote</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Enter your competitive freight rates. Shorter transit time breaks price ties on the leaderboard.
          </p>
        </div>
        {currentBestBid !== undefined && currentBestBid !== null && (
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium block">Your Best Quote</span>
            <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
              {formatCurrency(currentBestBid)}
            </span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Supplier Fleet / Vessel Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Vessel / Fleet Identifier
            </label>
            <input
              type="text"
              value={fleetName}
              onChange={(e) => setFleetName(e.target.value)}
              placeholder="e.g. Maersk Triple-E / BlueDart Van #12"
              disabled={disabled || isSubmitting}
              className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 disabled:bg-slate-50"
            />
          </div>

          {/* Freight Charges */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Base Freight Charge (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="1"
              min="1"
              value={freightCharge}
              onChange={(e) => setFreightCharge(e.target.value)}
              placeholder="40000"
              required
              disabled={disabled || isSubmitting}
              className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 disabled:bg-slate-50"
            />
          </div>

          {/* Origin Charges */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Origin Handling Charges (₹)
            </label>
            <input
              type="number"
              step="1"
              min="0"
              value={originCharge}
              onChange={(e) => setOriginCharge(e.target.value)}
              placeholder="0"
              disabled={disabled || isSubmitting}
              className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 disabled:bg-slate-50"
            />
          </div>

          {/* Destination Charges */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Destination Handling Charges (₹)
            </label>
            <input
              type="number"
              step="1"
              min="0"
              value={destinationCharge}
              onChange={(e) => setDestinationCharge(e.target.value)}
              placeholder="0"
              disabled={disabled || isSubmitting}
              className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 disabled:bg-slate-50"
            />
          </div>

          {/* Transit Time */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Transit Time (Hours)
            </label>
            <input
              type="number"
              min="1"
              value={transitTimeHours}
              onChange={(e) => setTransitTimeHours(e.target.value)}
              placeholder="48"
              disabled={disabled || isSubmitting}
              className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 disabled:bg-slate-50"
            />
          </div>

          {/* Validity of Quote */}
          <div>
            <DateTimePicker
              label="Quote Validity"
              selected={validUntil}
              onChange={(d) => setValidUntil(d)}
              minDate={new Date()}
              mode="date"
              presets={[
                { label: '7 Days', offsetDays: 7 },
                { label: '14 Days', offsetDays: 14 },
                { label: '30 Days', offsetDays: 30 },
                { label: '60 Days', offsetDays: 60 },
              ]}
              helpText="Period for which submitted rates remain guaranteed"
            />
          </div>
        </div>

        {/* Calculated Total Summary Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-md p-3 flex justify-between items-center">
          <div>
            <span className="text-xs text-slate-500">Landed Total (Freight + Surcharges):</span>
            <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">
              {formatCurrency(total)}
            </div>
            {isSameAsExistingQuote && (
              <span className="text-amber-600 text-[11px] font-medium block mt-1">
                ⚠ You cannot submit the same quote amount of {formatCurrency(total)} again.
              </span>
            )}
          </div>

          <div className="text-right text-xs text-slate-600">
            <span>Transit: <strong>{transitTimeHours || '—'} hrs</strong></span>
          </div>
        </div>

        <button
          type="submit"
          disabled={disabled || isSubmitting || total <= 0 || isSameAsExistingQuote}
          className="w-full py-2.5 px-4 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Submitting Quote...' : 'Submit Competitive Quote'}
        </button>
      </form>
    </div>
  );
};
