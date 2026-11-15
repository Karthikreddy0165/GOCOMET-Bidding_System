import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../api/client';
import toast from 'react-hot-toast';
import { LogOut, RotateCcw } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isResetting, setIsResetting] = useState(false);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleResetDemoData = async () => {
    if (isResetting) return;
    setIsResetting(true);
    const toastId = toast.loading('Resetting demo auctions & bids...');
    try {
      await apiClient.post('/demo/reset');
      toast.success('Demo data reloaded with fresh auctions!', { id: toastId });
      navigate('/auctions');
      window.location.reload();
    } catch (err: any) {
      toast.error('Failed to reset demo data', { id: toastId });
    } finally {
      setIsResetting(false);
    }
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 items-center">
          {/* Brand */}
          <div className="flex items-center space-x-6">
            <Link to="/auctions" className="flex items-center gap-2.5">
              <span className="text-base font-bold text-slate-900 tracking-tight">GoComet</span>
              <span className="text-slate-300">|</span>
              <span className="text-xs font-medium text-slate-500">RFQ British Auction</span>
            </Link>

            {/* Navigation links */}
            <nav className="hidden sm:flex items-center space-x-1">
              <Link
                to="/auctions"
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  isActive('/auctions')
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Auctions
              </Link>

              {user.role === 'BUYER' && (
                <Link
                  to="/rfqs"
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    isActive('/rfqs')
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  My RFQs
                </Link>
              )}
            </nav>
          </div>

          {/* Right actions */}
          <div className="flex items-center space-x-3">
            {/* Quick Demo Reset Button */}
            <button
              type="button"
              onClick={handleResetDemoData}
              disabled={isResetting}
              title="Reset demo data with active auctions and bids"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-slate-500 ${isResetting ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Reset Demo Data</span>
            </button>

            {user.role === 'BUYER' && (
              <Link
                to="/rfqs/create"
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
              >
                Create RFQ
              </Link>
            )}

            {/* User profile / Logout */}
            <div className="flex items-center space-x-2 pl-3 border-l border-slate-200 text-xs">
              <div className="text-right">
                <span className="font-medium text-slate-800 block truncate max-w-[130px]">
                  {user.full_name || user.email}
                </span>
                <span className="text-[10px] text-slate-500 font-mono uppercase">
                  {user.role}
                </span>
              </div>

              <button
                onClick={handleLogout}
                title="Sign Out"
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors ml-1"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
