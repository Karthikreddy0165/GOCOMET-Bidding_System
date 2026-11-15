import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  targetDate: string;
  triggerWindowMinutes?: number;
  onExpire?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  targetDate,
  onExpire,
  size = 'md',
}) => {
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    totalSeconds: number;
    isExpired: boolean;
  }>({ hours: 0, minutes: 0, seconds: 0, totalSeconds: 0, isExpired: false });

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date().getTime();
      const end = new Date(targetDate).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, totalSeconds: 0, isExpired: true });
        if (onExpire) onExpire();
        return;
      }

      const totalSeconds = Math.floor(diff / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      setTimeLeft({ hours, minutes, seconds, totalSeconds, isExpired: false });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [targetDate, onExpire]);

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (timeLeft.isExpired) {
    return (
      <span className="inline-flex items-center gap-1.5 text-slate-500 font-medium text-xs bg-slate-100 px-2.5 py-1 rounded-md">
        <Clock className="w-3.5 h-3.5 text-slate-400" />
        <span>Bidding Closed</span>
      </span>
    );
  }

  if (size === 'sm') {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 rounded-md border bg-slate-50 text-slate-800 border-slate-200 font-semibold">
        <Clock className="w-3 h-3 text-slate-500" />
        {timeLeft.hours > 0 && `${pad(timeLeft.hours)}:`}{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
      </span>
    );
  }

  if (size === 'lg') {
    return (
      <div className="flex flex-col items-start sm:items-end">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border shadow-sm font-mono font-bold tracking-tight text-xl bg-slate-900 text-white border-slate-800">
          <Clock className="w-4 h-4 text-blue-400" />
          <span>
            {timeLeft.hours > 0 && `${pad(timeLeft.hours)}h `}
            {pad(timeLeft.minutes)}m {pad(timeLeft.seconds)}s
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border bg-slate-100 text-slate-800 border-slate-200">
      <Clock className="w-3.5 h-3.5 text-slate-500" />
      <span className="font-mono">
        {timeLeft.hours > 0 && `${pad(timeLeft.hours)}h `}
        {pad(timeLeft.minutes)}m {pad(timeLeft.seconds)}s
      </span>
    </div>
  );
};
