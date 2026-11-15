import React from 'react';

interface StatusBadgeProps {
  status: 'ACTIVE' | 'SCHEDULED' | 'CLOSED' | 'FORCE_CLOSED' | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const configs: Record<string, { label: string; dot: string; bg: string; text: string }> = {
    ACTIVE: { label: 'Active', dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800' },
    SCHEDULED: { label: 'Scheduled', dot: 'bg-blue-500', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800' },
    CLOSED: { label: 'Closed', dot: 'bg-slate-400', bg: 'bg-slate-100 border-slate-200', text: 'text-slate-600' },
    FORCE_CLOSED: { label: 'Force Closed', dot: 'bg-amber-500', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800' },
  };

  const current = configs[status] || {
    label: status,
    dot: 'bg-slate-400',
    bg: 'bg-slate-100 border-slate-200',
    text: 'text-slate-600',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-medium ${current.bg} ${current.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${current.dot} ${status === 'ACTIVE' ? 'animate-pulse' : ''}`} />
      <span>{current.label}</span>
    </span>
  );
};
