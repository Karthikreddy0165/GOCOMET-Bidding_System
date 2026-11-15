import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { RFQ } from '../types';
import { format } from 'date-fns';

export const RFQListPage: React.FC = () => {
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRfqs = async () => {
      try {
        const res = await apiClient.get<RFQ[]>('/rfqs/');
        setRfqs(res.data);
      } catch (err) {
        console.error('Failed to load RFQs:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRfqs();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            My RFQ Inquiries
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage logistics quotations and associated British reverse auctions.
          </p>
        </div>

        <Link
          to="/rfqs/create"
          className="px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-xs transition-colors"
        >
          + Create New RFQ
        </Link>
      </div>

      {isLoading ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center shadow-xs">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-slate-500 font-medium">Loading RFQs...</p>
        </div>
      ) : rfqs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center shadow-xs">
          <p className="text-sm font-semibold text-slate-800">No RFQs Created</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
            You have not created any logistics quotation requests yet.
          </p>
          <Link
            to="/rfqs/create"
            className="inline-block px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 shadow-xs"
          >
            Create First RFQ
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rfqs.map((rfq) => (
            <div
              key={rfq.id}
              className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                    {rfq.reference}
                  </span>
                  <span className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                    {rfq.status}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900">{rfq.name}</h3>
                {rfq.description && (
                  <p className="text-xs text-slate-500 line-clamp-1">{rfq.description}</p>
                )}
                <p className="text-xs text-slate-400 pt-0.5">
                  Pickup: {format(new Date(rfq.pickup_service_at), 'dd MMM yyyy, hh:mm a')}
                </p>
              </div>

              <Link
                to="/auctions"
                className="px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                View Auctions
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
