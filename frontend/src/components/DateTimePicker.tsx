import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import {
  format,
  addDays,
  addHours,
  addMinutes,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  isBefore,
  startOfDay,
  setHours,
  setMinutes,
} from 'date-fns';

export interface DateTimePreset {
  label: string;
  offsetMinutes?: number;
  offsetHours?: number;
  offsetDays?: number;
}

interface DateTimePickerProps {
  label: string;
  selected: Date | null;
  onChange: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  required?: boolean;
  helpText?: string;
  presets?: DateTimePreset[];
  baseDateForPresets?: Date;
  mode?: 'datetime' | 'date';
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  label,
  selected,
  onChange,
  minDate,
  maxDate,
  required = false,
  helpText,
  presets,
  baseDateForPresets,
  mode = 'datetime',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentDate = selected && !isNaN(selected.getTime()) ? selected : new Date();
  const [viewMonth, setViewMonth] = useState<Date>(currentDate);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Keep viewMonth in sync when selected date changes
  useEffect(() => {
    if (selected && !isNaN(selected.getTime())) {
      setViewMonth(selected);
    }
  }, [selected]);

  // Calendar month days generation
  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let dayCursor = startDate;
  while (dayCursor <= endDate) {
    days.push(dayCursor);
    dayCursor = addDays(dayCursor, 1);
  }

  // Time handling (12-hour format with AM/PM)
  const currentHours = currentDate.getHours();
  const isPM = currentHours >= 12;
  const currentHour12 = currentHours % 12 === 0 ? 12 : currentHours % 12;
  const currentMinute = currentDate.getMinutes();

  const handleDaySelect = (day: Date) => {
    let nextDate = new Date(day);
    if (mode === 'datetime') {
      nextDate = setHours(nextDate, currentDate.getHours());
      nextDate = setMinutes(nextDate, currentDate.getMinutes());
    } else {
      nextDate = setHours(nextDate, 12);
      nextDate = setMinutes(nextDate, 0);
    }
    onChange(nextDate);
    if (mode === 'date') {
      setIsOpen(false);
    }
  };

  const handleTimeChange = (hour12: number, minute: number, pm: boolean) => {
    let nextH = hour12 % 12;
    if (pm) nextH += 12;
    const nextDate = setMinutes(setHours(new Date(currentDate), nextH), minute);
    onChange(nextDate);
  };

  const applyPreset = (preset: DateTimePreset) => {
    const base = baseDateForPresets || minDate || new Date();
    let next = new Date(base);
    if (preset.offsetMinutes) next = addMinutes(next, preset.offsetMinutes);
    if (preset.offsetHours) next = addHours(next, preset.offsetHours);
    if (preset.offsetDays) next = addDays(next, preset.offsetDays);
    onChange(next);
  };

  const formattedDisplay = selected
    ? mode === 'datetime'
      ? format(selected, 'EEE, d MMM yyyy, hh:mm a')
      : format(selected, 'EEE, d MMM yyyy')
    : 'Select date & time';

  const isDayDisabled = (d: Date) => {
    if (minDate && isBefore(startOfDay(d), startOfDay(minDate))) return true;
    if (maxDate && isBefore(startOfDay(maxDate), startOfDay(d))) return true;
    return false;
  };

  return (
    <div className="w-full relative" ref={containerRef}>
      {/* Label and Presets Strip */}
      <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
        <label className="block text-xs font-semibold text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>

        {presets && presets.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                className="text-[10px] font-semibold text-blue-700 bg-blue-50/80 hover:bg-blue-100 hover:text-blue-900 px-2 py-0.5 rounded border border-blue-200/60 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-md border transition-all text-left bg-white shadow-xs ${
          isOpen
            ? 'border-blue-600 ring-2 ring-blue-100'
            : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        <div className="flex items-center gap-2 text-slate-800">
          {mode === 'datetime' ? (
            <Clock className="w-4 h-4 text-blue-600 shrink-0" />
          ) : (
            <CalendarIcon className="w-4 h-4 text-blue-600 shrink-0" />
          )}
          <span className="font-medium">{formattedDisplay}</span>
        </div>
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          {isOpen ? 'Close' : 'Change'}
        </span>
      </button>

      {helpText && <p className="text-[11px] text-slate-500 mt-1">{helpText}</p>}

      {/* Floating Popover Picker */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-72 sm:w-80 bg-white border border-slate-200 rounded-lg shadow-xl p-3.5 left-0 animate-in fade-in zoom-in-95 duration-100">
          {/* Calendar Header: Month & Year with Navigation */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-900 tracking-tight">
              {format(viewMonth, 'MMMM yyyy')}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewMonth(addDays(monthStart, -1))}
                className="p-1 hover:bg-slate-100 rounded text-slate-600 transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMonth(addDays(monthEnd, 1))}
                className="p-1 hover:bg-slate-100 rounded text-slate-600 transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((w) => (
              <span key={w} className="text-[10px] font-semibold text-slate-400 uppercase">
                {w}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {days.map((day, idx) => {
              const disabled = isDayDisabled(day);
              const isSelected = selected && isSameDay(day, selected);
              const inCurrentMonth = isSameMonth(day, viewMonth);
              const isToday = isSameDay(day, new Date());

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleDaySelect(day)}
                  className={`h-7 w-7 sm:h-8 sm:w-8 mx-auto flex items-center justify-center rounded-md text-xs font-medium transition-all ${
                    disabled
                      ? 'text-slate-300 cursor-not-allowed'
                      : isSelected
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : isToday
                      ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200'
                      : inCurrentMonth
                      ? 'text-slate-800 hover:bg-slate-100'
                      : 'text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          {/* Time Picker Section (if mode === 'datetime') */}
          {mode === 'datetime' && (
            <div className="mt-3.5 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-700 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> Time (IST)
                </span>
                <span className="font-mono text-slate-500 font-medium">
                  {format(currentDate, 'hh:mm a')}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Hour Select */}
                <select
                  value={currentHour12}
                  onChange={(e) =>
                    handleTimeChange(parseInt(e.target.value), currentMinute, isPM)
                  }
                  className="px-2 py-1 text-xs border border-slate-300 rounded font-mono bg-white text-slate-800 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                >
                  {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}
                    </option>
                  ))}
                </select>

                <span className="text-slate-400 font-bold">:</span>

                {/* Minute Select (5-minute increments) */}
                <select
                  value={Math.floor(currentMinute / 5) * 5}
                  onChange={(e) =>
                    handleTimeChange(currentHour12, parseInt(e.target.value), isPM)
                  }
                  className="px-2 py-1 text-xs border border-slate-300 rounded font-mono bg-white text-slate-800 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                >
                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                    <option key={m} value={m}>
                      {String(m).padStart(2, '0')}
                    </option>
                  ))}
                </select>

                {/* AM / PM Segmented Toggle */}
                <div className="flex rounded border border-slate-200 overflow-hidden ml-auto">
                  <button
                    type="button"
                    onClick={() => handleTimeChange(currentHour12, currentMinute, false)}
                    className={`px-2 py-1 text-[11px] font-semibold transition-colors ${
                      !isPM ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTimeChange(currentHour12, currentMinute, true)}
                    className={`px-2 py-1 text-[11px] font-semibold transition-colors ${
                      isPM ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    PM
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Done Button */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-1 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold shadow-xs transition-colors"
            >
              <Check className="w-3.5 h-3.5" /> Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
