import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { DISTANCE_GROUPS, DistanceGroupId } from '../types';
import { X, Lock, Mail, User, CheckCircle2, Shield, AlertCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultMode = 'login',
}) => {
  const { club, login, signup, resetPassword, bootstrapAdmin } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>(defaultMode);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<DistanceGroupId>('up_to_50');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        const res = await login(email, password);
        if (!res.success) {
          setErrorMsg(res.error || 'Login failed.');
        } else {
          onClose();
        }
      } else if (mode === 'signup') {
        if (!displayName.trim()) {
          setErrorMsg('Please enter your runner display name.');
          setIsSubmitting(false);
          return;
        }
        const res = await signup(email, password, displayName, selectedGroup);
        if (!res.success) {
          setErrorMsg(res.error || 'Signup failed.');
        } else {
          onClose();
        }
      } else if (mode === 'reset') {
        const res = await resetPassword(email);
        setSuccessMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminBootstrap = async () => {
    await bootstrapAdmin();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-[#FAF9F6] text-[#141414] rounded-2xl p-6 shadow-2xl border border-neutral-300 relative my-8 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-neutral-500 hover:bg-neutral-200 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#FF9F1C] flex items-center justify-center font-black text-[#141414] text-xs mb-3">
            5AM
          </div>
          <h2 className="text-xl font-bold tracking-tight text-[#141414]">
            {mode === 'login' && 'Welcome Back, Runner'}
            {mode === 'signup' && `Join ${club.name}`}
            {mode === 'reset' && 'Reset Password'}
          </h2>
          <p className="text-xs text-neutral-600 mt-1">
            {mode === 'login' && 'Sign in to sync your Strava activities and view club rankings.'}
            {mode === 'signup' && 'Create your runner profile and choose your monthly goal group.'}
            {mode === 'reset' && 'Enter your registered email to receive password reset link.'}
          </p>
        </div>

        {/* Mode Tabs */}
        {mode !== 'reset' && (
          <div className="flex bg-neutral-200/80 p-1 rounded-xl mb-4 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
              }}
              className={`flex-1 py-1.5 rounded-lg transition ${
                mode === 'login' ? 'bg-[#141414] text-[#FAF9F6] shadow-xs' : 'text-neutral-600'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMsg(null);
              }}
              className={`flex-1 py-1.5 rounded-lg transition ${
                mode === 'signup' ? 'bg-[#141414] text-[#FAF9F6] shadow-xs' : 'text-neutral-600'
              }`}
            >
              New Runner Sign Up
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-700">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Display Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Joydeep Roy"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-neutral-300 rounded-xl focus:outline-hidden focus:border-[#FF9F1C]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
              <input
                type="email"
                required
                placeholder="runner@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-neutral-300 rounded-xl focus:outline-hidden focus:border-[#FF9F1C]"
              />
            </div>
          </div>

          {mode !== 'reset' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-neutral-700">Password</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('reset');
                      setErrorMsg(null);
                    }}
                    className="text-[11px] text-[#FF9F1C] font-semibold hover:underline"
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-neutral-300 rounded-xl focus:outline-hidden focus:border-[#FF9F1C]"
                />
              </div>
            </div>
          )}

          {/* Goal Group Selection on Signup (Exact three labels) */}
          {mode === 'signup' && (
            <div className="pt-1">
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                Desired Monthly Distance Group (October 2026)
              </label>
              <div className="space-y-2">
                {(Object.keys(DISTANCE_GROUPS) as DistanceGroupId[]).map((groupId) => {
                  const cfg = DISTANCE_GROUPS[groupId];
                  const isSelected = selectedGroup === groupId;
                  return (
                    <div
                      key={groupId}
                      onClick={() => setSelectedGroup(groupId)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition flex items-center justify-between ${
                        isSelected
                          ? 'border-[#FF9F1C] bg-[#FF9F1C]/10 text-[#141414]'
                          : 'border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold">{cfg.label}</p>
                        <p className="text-[11px] text-neutral-500">{cfg.description}</p>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-[#FF9F1C] bg-[#FF9F1C]' : 'border-neutral-400'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#141414]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-xl bg-[#FF9F1C] hover:bg-[#e08914] text-[#141414] font-bold text-sm transition active:scale-98 shadow-sm disabled:opacity-50 mt-2"
          >
            {isSubmitting ? (
              'Processing...'
            ) : mode === 'login' ? (
              'Sign In to Club'
            ) : mode === 'signup' ? (
              'Create Account & Join'
            ) : (
              'Send Reset Link'
            )}
          </button>
        </form>

        {mode === 'reset' && (
          <div className="mt-3 text-center">
            <button
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="text-xs text-neutral-600 hover:text-black font-semibold"
            >
              ← Back to Sign In
            </button>
          </div>
        )}

        {/* Quick Setup / Bootstrap Admin */}
        <div className="mt-5 pt-4 border-t border-neutral-200 flex flex-col gap-2">
          <p className="text-[11px] text-neutral-500 text-center">
            Testing convenience: Pre-configured Admin account available
          </p>
          <button
            type="button"
            onClick={handleAdminBootstrap}
            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-[#141414] text-[#FAF9F6] text-xs font-semibold hover:bg-neutral-800 transition"
          >
            <Shield className="w-3.5 h-3.5 text-[#FFD600]" />
            <span>Sign In as Admin (Aritra Sen)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
