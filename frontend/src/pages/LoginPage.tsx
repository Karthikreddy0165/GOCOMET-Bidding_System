import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../api/client';
import toast from 'react-hot-toast';
import { Briefcase, Ship, KeyRound, ArrowRight } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await apiClient.post('/auth/login', { email, password });
      await login(res.data.access_token);
      toast.success('Signed in successfully');
      navigate('/auctions');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password123');
    setIsLoading(true);
    try {
      const res = await apiClient.post('/auth/login', { email: demoEmail, password: 'password123' });
      await login(res.data.access_token);
      toast.success(`Signed in as ${demoEmail}`);
      navigate('/auctions');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-10 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          GoComet RFQ Bidding System
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Sign in to access British Reverse Auction logistics procurement
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-6 px-5 shadow-xs border border-slate-200 rounded-lg sm:px-8">
          <form className="space-y-4" onSubmit={handleLogin}>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="buyer@gocomet.com or maersk@shipping.com"
                className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 px-4 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-xs transition-colors disabled:bg-slate-300"
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          {/* Quick 1-Click Demo Logins */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                1-Click Sample Demo Logins
              </span>
              <span className="text-[10px] text-slate-500 font-mono">pwd: password123</span>
            </div>

            {/* Buyer Logins */}
            <div className="mb-3">
              <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1 mb-1.5">
                <Briefcase className="w-3 h-3 text-slate-400" /> BUYER ACCOUNTS
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('buyer@gocomet.com')}
                  className="px-2.5 py-2 rounded border border-blue-200 bg-blue-50/60 hover:bg-blue-100/70 text-left transition-colors group"
                >
                  <div className="text-xs font-semibold text-blue-900 flex items-center justify-between">
                    GoComet
                    <ArrowRight className="w-3 h-3 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-[10px] text-blue-700 truncate font-mono">buyer@gocomet.com</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('buyer1@test.com')}
                  className="px-2.5 py-2 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition-colors group"
                >
                  <div className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                    Apex Logistics
                    <ArrowRight className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-[10px] text-slate-500 truncate font-mono">buyer1@test.com</div>
                </button>
              </div>
            </div>

            {/* Supplier Logins */}
            <div>
              <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1 mb-1.5">
                <Ship className="w-3 h-3 text-slate-400" /> SUPPLIER ACCOUNTS
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('maersk@shipping.com')}
                  className="px-2.5 py-2 rounded border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/70 text-left transition-colors group"
                >
                  <div className="text-xs font-semibold text-emerald-900 flex items-center justify-between">
                    Maersk
                    <ArrowRight className="w-3 h-3 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-[10px] text-emerald-700 truncate font-mono">maersk@shipping.com</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('hapag@shipping.com')}
                  className="px-2.5 py-2 rounded border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/70 text-left transition-colors group"
                >
                  <div className="text-xs font-semibold text-emerald-900 flex items-center justify-between">
                    Hapag-Lloyd
                    <ArrowRight className="w-3 h-3 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-[10px] text-emerald-700 truncate font-mono">hapag@shipping.com</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('msc@shipping.com')}
                  className="px-2.5 py-2 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition-colors group"
                >
                  <div className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                    MSC Shipping
                    <ArrowRight className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-[10px] text-slate-500 truncate font-mono">msc@shipping.com</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('supplier1@test.com')}
                  className="px-2.5 py-2 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition-colors group"
                >
                  <div className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                    FastTrack Logistics
                    <ArrowRight className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-[10px] text-slate-500 truncate font-mono">supplier1@test.com</div>
                </button>
              </div>
            </div>

            {/* Reload Demo Data Shortcut */}
            <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-500">Need fresh active auctions?</span>
              <button
                type="button"
                onClick={async () => {
                  const tId = toast.loading('Resetting demo auctions & bids...');
                  try {
                    await apiClient.post('/demo/reset');
                    toast.success('Fresh demo auctions loaded!', { id: tId });
                  } catch (e) {
                    toast.error('Failed to reset demo data', { id: tId });
                  }
                }}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
              >
                🔄 Reset / Reload Demo Data
              </button>
            </div>
          </div>

          <div className="mt-5 text-center text-xs text-slate-500">
            Don't have an account?{' '}
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
