import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import toast from 'react-hot-toast';
import { DateTimePicker } from '../components/DateTimePicker';
import { format, addMinutes, addHours, addDays } from 'date-fns';
import { Zap, Calendar, Shield, Clock, ArrowRight } from 'lucide-react';

export const CreateRFQPage: React.FC = () => {
  const navigate = useNavigate();

  // RFQ fields
  const [reference, setReference] = useState(`RFQ-${Date.now().toString().slice(-6)}`);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pickupDate, setPickupDate] = useState<Date>(
    new Date(Date.now() + 5 * 86400000)
  );

  // Auction Start fields
  const [startMode, setStartMode] = useState<'immediate' | 'scheduled'>('immediate');
  const [startAt, setStartAt] = useState<Date>(new Date());

  // Duration selection
  const [durationMinutes, setDurationMinutes] = useState<number>(60); // 1 hour default
  const [isCustomClose, setIsCustomClose] = useState<boolean>(false);
  const [scheduledCloseAt, setScheduledCloseAt] = useState<Date>(
    new Date(Date.now() + 60 * 60000)
  );

  // Forced Close (Ceiling) selection
  const [ceilingExtraMinutes, setCeilingExtraMinutes] = useState<number>(120); // +2 hours default
  const [isCustomCeiling, setIsCustomCeiling] = useState<boolean>(false);
  const [forcedCloseAt, setForcedCloseAt] = useState<Date>(
    new Date(Date.now() + 180 * 60000)
  );

  // Config parameters (X and Y)
  const [triggerWindowMinutes, setTriggerWindowMinutes] = useState(10);
  const [extensionMinutes, setExtensionMinutes] = useState(5);
  const [triggerBidReceived, setTriggerBidReceived] = useState(true);
  const [triggerAnyRankChange, setTriggerAnyRankChange] = useState(true);
  const [triggerL1Change, setTriggerL1Change] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle start mode changes
  const handleStartModeChange = (mode: 'immediate' | 'scheduled') => {
    setStartMode(mode);
    const effectiveStart = mode === 'immediate' ? new Date() : addHours(new Date(), 2);
    setStartAt(effectiveStart);

    if (!isCustomClose) {
      const newClose = addMinutes(effectiveStart, durationMinutes);
      setScheduledCloseAt(newClose);
      if (!isCustomCeiling) {
        setForcedCloseAt(addMinutes(newClose, ceilingExtraMinutes));
      }
    }
  };

  // Handle scheduled start change
  const handleStartAtChange = (newStart: Date) => {
    setStartAt(newStart);
    if (!isCustomClose) {
      const newClose = addMinutes(newStart, durationMinutes);
      setScheduledCloseAt(newClose);
      if (!isCustomCeiling) {
        setForcedCloseAt(addMinutes(newClose, ceilingExtraMinutes));
      }
    } else if (scheduledCloseAt <= newStart) {
      const newClose = addMinutes(newStart, 60);
      setScheduledCloseAt(newClose);
      if (forcedCloseAt <= newClose) {
        setForcedCloseAt(addMinutes(newClose, 120));
      }
    }
  };

  // Handle duration chip click
  const handleDurationSelect = (mins: number) => {
    setIsCustomClose(false);
    setDurationMinutes(mins);
    const newClose = addMinutes(startAt, mins);
    setScheduledCloseAt(newClose);

    if (!isCustomCeiling) {
      setForcedCloseAt(addMinutes(newClose, ceilingExtraMinutes));
    } else if (forcedCloseAt <= newClose) {
      setForcedCloseAt(addMinutes(newClose, 120));
    }
  };

  // Handle ceiling chip click
  const handleCeilingSelect = (extraMins: number) => {
    setIsCustomCeiling(false);
    setCeilingExtraMinutes(extraMins);
    setForcedCloseAt(addMinutes(scheduledCloseAt, extraMins));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Please enter a Route Title');
      return;
    }

    if (scheduledCloseAt <= startAt) {
      toast.error('Bid Close Time must be strictly later than Start Time');
      return;
    }

    if (forcedCloseAt <= scheduledCloseAt) {
      toast.error('Safeguard Rule: Forced Close Time must be strictly later than Scheduled Close');
      return;
    }

    if (triggerWindowMinutes <= 0 || extensionMinutes <= 0) {
      toast.error('Trigger window and extension increment must be greater than 0');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Create RFQ
      const rfqRes = await apiClient.post('/rfqs/', {
        reference,
        name,
        description,
        pickup_service_at: pickupDate.toISOString(),
      });
      const rfqId = rfqRes.data.id;

      // 2. Create British Auction with configuration
      const auctionRes = await apiClient.post(`/rfqs/${rfqId}/auction`, {
        start_at: startAt.toISOString(),
        scheduled_close_at: scheduledCloseAt.toISOString(),
        forced_close_at: forcedCloseAt.toISOString(),
        config: {
          trigger_window_minutes: triggerWindowMinutes,
          extension_minutes: extensionMinutes,
          trigger_bid_received: triggerBidReceived,
          trigger_any_rank_change: triggerAnyRankChange,
          trigger_l1_change: triggerL1Change,
        },
      });

      toast.success('RFQ and British Auction created successfully');
      navigate(`/auctions/${auctionRes.data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create RFQ auction');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Create RFQ & British Auction</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure freight specifications, bidding duration, and dynamic anti-sniping extension safeguards.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: RFQ & Cargo Details */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="text-sm font-bold text-slate-900">1. Shipment & Route Specifications</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Reference ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="RFQ-2026-MUM-01"
                className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md font-mono focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <DateTimePicker
                label="Cargo Pickup / Service Date"
                selected={pickupDate}
                onChange={(d) => setPickupDate(d)}
                minDate={new Date()}
                mode="date"
                required
                presets={[
                  { label: '+2 Days', offsetDays: 2 },
                  { label: '+5 Days', offsetDays: 5 },
                  { label: '+10 Days', offsetDays: 10 },
                  { label: '+1 Month', offsetDays: 30 },
                ]}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Route Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Nhava Sheva (JNPT) to Rotterdam 50x 40ft High-Cube Haulage"
              className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Cargo Scope & Instructions
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Containers, cargo tonnage, packaging, customs clearance notes..."
              className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Section 2: Auction Schedule & Timeline Builder */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="text-sm font-bold text-slate-900">2. Bidding Schedule & Duration</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Set when bidding opens, how long it runs, and the anti-sniping extension ceiling.
            </p>
          </div>

          {/* 2A: Start Time Mode */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Auction Start Time
            </label>
            <div className="grid grid-cols-2 gap-2 max-w-md">
              <button
                type="button"
                onClick={() => handleStartModeChange('immediate')}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                  startMode === 'immediate'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Zap className={`w-4 h-4 ${startMode === 'immediate' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>Start Immediately</span>
              </button>

              <button
                type="button"
                onClick={() => handleStartModeChange('scheduled')}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                  startMode === 'scheduled'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Calendar className={`w-4 h-4 ${startMode === 'scheduled' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>Schedule for Later</span>
              </button>
            </div>

            {startMode === 'scheduled' && (
              <div className="mt-3 max-w-sm">
                <DateTimePicker
                  label="Scheduled Start Date & Time"
                  selected={startAt}
                  onChange={handleStartAtChange}
                  minDate={new Date()}
                  required
                  presets={[
                    { label: '+1 Hour', offsetHours: 1 },
                    { label: '+3 Hours', offsetHours: 3 },
                    { label: 'Tomorrow', offsetDays: 1 },
                  ]}
                />
              </div>
            )}
          </div>

          {/* 2B: Auction Duration */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-700">
                Bidding Duration
              </label>
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60">
                Closes: {format(scheduledCloseAt, 'EEE, d MMM, hh:mm a')}
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { label: '30 Mins', mins: 30 },
                { label: '1 Hour', mins: 60 },
                { label: '2 Hours', mins: 120 },
                { label: '4 Hours', mins: 240 },
                { label: '24 Hours', mins: 1440 },
              ].map((d) => (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => handleDurationSelect(d.mins)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border ${
                    !isCustomClose && durationMinutes === d.mins
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {d.label}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setIsCustomClose(true)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border ${
                  isCustomClose
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Custom End Time
              </button>
            </div>

            {isCustomClose && (
              <div className="mt-3 max-w-sm">
                <DateTimePicker
                  label="Exact Close Date & Time"
                  selected={scheduledCloseAt}
                  onChange={(d) => {
                    setScheduledCloseAt(d);
                    if (forcedCloseAt <= d) {
                      setForcedCloseAt(addMinutes(d, 120));
                    }
                  }}
                  minDate={startAt}
                  required
                />
              </div>
            )}
          </div>

          {/* 2C: Hard Ceiling (Forced Close Safeguard) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                  Safeguard Rule: Forced Close Ceiling
                </label>
                <p className="text-[11px] text-slate-500">
                  Absolute hard deadline. Dynamic extensions can never exceed this ceiling.
                </p>
              </div>
              <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                Hard Stop: {format(forcedCloseAt, 'EEE, d MMM, hh:mm a')}
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              {[
                { label: '+1 Hour Max', extra: 60 },
                { label: '+2 Hours Max', extra: 120 },
                { label: '+4 Hours Max', extra: 240 },
                { label: '+12 Hours Max', extra: 720 },
                { label: '+24 Hours Max', extra: 1440 },
              ].map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => handleCeilingSelect(c.extra)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border ${
                    !isCustomCeiling && ceilingExtraMinutes === c.extra
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {c.label}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setIsCustomCeiling(true)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border ${
                  isCustomCeiling
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Custom Ceiling
              </button>
            </div>

            {isCustomCeiling && (
              <div className="mt-3 max-w-sm">
                <DateTimePicker
                  label="Exact Forced Close Ceiling"
                  selected={forcedCloseAt}
                  onChange={(d) => setForcedCloseAt(d)}
                  minDate={scheduledCloseAt}
                  required
                />
              </div>
            )}
          </div>

          {/* 2D: Visual Timeline Progress Bar */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Configured Auction Bidding Timeline
            </div>
            <div className="flex items-center justify-between text-xs font-mono text-slate-800 gap-2">
              <div className="text-left">
                <span className="block text-[10px] text-slate-400 uppercase font-sans font-bold">Start</span>
                <span className="font-semibold">{format(startAt, 'hh:mm a')}</span>
                <span className="text-[10px] text-slate-500 block font-sans">{format(startAt, 'd MMM')}</span>
              </div>

              <div className="flex-1 flex items-center justify-center relative px-2">
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden flex">
                  <div className="bg-blue-500 h-full flex-1" />
                  <div className="bg-amber-400 h-full w-12" title="Anti-sniping trigger window" />
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 absolute right-0" />
              </div>

              <div className="text-center">
                <span className="block text-[10px] text-blue-600 uppercase font-sans font-bold">Scheduled Close</span>
                <span className="font-semibold text-blue-900">{format(scheduledCloseAt, 'hh:mm a')}</span>
                <span className="text-[10px] text-slate-500 block font-sans">{format(scheduledCloseAt, 'd MMM')}</span>
              </div>

              <div className="flex-1 flex items-center justify-center relative px-2">
                <div className="w-full h-1.5 bg-emerald-200 rounded-full" />
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 absolute right-0" />
              </div>

              <div className="text-right">
                <span className="block text-[10px] text-emerald-600 uppercase font-sans font-bold">Hard Ceiling</span>
                <span className="font-semibold text-emerald-900">{format(forcedCloseAt, 'hh:mm a')}</span>
                <span className="text-[10px] text-slate-500 block font-sans">{format(forcedCloseAt, 'd MMM')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Dynamic Anti-Sniping Extension Rules */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="text-sm font-bold text-slate-900">3. Anti-Sniping Dynamic Extension Rules</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Automatically extends bidding deadline if qualifying supplier actions occur in the closing window.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Trigger Window (X in minutes)
              </label>
              <div className="flex items-center gap-1.5 mb-1.5">
                {[5, 10, 15, 20].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setTriggerWindowMinutes(mins)}
                    className={`px-2 py-0.5 text-[11px] rounded font-semibold border ${
                      triggerWindowMinutes === mins
                        ? 'bg-blue-50 text-blue-700 border-blue-300'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="1"
                required
                value={triggerWindowMinutes}
                onChange={(e) => setTriggerWindowMinutes(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Monitors bids in the last X minutes before current close time.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Extension Duration (Y in minutes)
              </label>
              <div className="flex items-center gap-1.5 mb-1.5">
                {[3, 5, 10, 15].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setExtensionMinutes(mins)}
                    className={`px-2 py-0.5 text-[11px] rounded font-semibold border ${
                      extensionMinutes === mins
                        ? 'bg-blue-50 text-blue-700 border-blue-300'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    +{mins}m
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="1"
                required
                value={extensionMinutes}
                onChange={(e) => setExtensionMinutes(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Time appended to current close when a qualified trigger occurs.
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-start gap-2.5 p-2.5 rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={triggerBidReceived}
                onChange={(e) => setTriggerBidReceived(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="font-semibold text-slate-900">Trigger A: Any Bid Received</span>
                <p className="text-[11px] text-slate-500">Extends when any supplier submits a quote within the trigger window.</p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-2.5 rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={triggerAnyRankChange}
                onChange={(e) => setTriggerAnyRankChange(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="font-semibold text-slate-900">Trigger B: Any Supplier Rank Change</span>
                <p className="text-[11px] text-slate-500">Extends if any rank shift occurs among participating suppliers.</p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-2.5 rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={triggerL1Change}
                onChange={(e) => setTriggerL1Change(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="font-semibold text-slate-900">Trigger C: Lowest Bidder (L1) Change</span>
                <p className="text-[11px] text-slate-500">Extends only when the leading (L1) position changes hands.</p>
              </div>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/auctions')}
            className="px-4 py-2 rounded-md text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors disabled:bg-slate-300"
          >
            {isSubmitting ? 'Creating British Auction...' : 'Publish British Reverse Auction'}
          </button>
        </div>
      </form>
    </div>
  );
};
