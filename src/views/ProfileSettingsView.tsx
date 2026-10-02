import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { DISTANCE_GROUPS, DistanceGroupId } from '../types';
import { formatDateInIST } from '../lib/dateUtils';
import { PWAInstallButton } from '../components/PWAInstallButton';
import {
  User,
  Activity,
  Calendar,
  LogOut,
  Shield,
  Download,
  CheckCircle,
  AlertTriangle,
  Edit2,
  Trash2,
  Info,
  ExternalLink,
  Copy,
  Unlink,
} from 'lucide-react';

interface ProfileSettingsViewProps {
  onOpenAuth: () => void;
}

export const ProfileSettingsView: React.FC<ProfileSettingsViewProps> = ({
  onOpenAuth,
}) => {
  const {
    club,
    currentUser,
    isAuthenticated,
    isAdmin,
    updateProfile,
    selectNextMonthGoal,
    disconnectStrava,
    leaveClub,
    logout,
    stravaStatus,
    bootstrapAdmin,
    connectStravaOAuth,
    syncStravaRuns,
  } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(currentUser?.displayName || '');
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [copiedField, setCopiedField] = useState<'domain' | 'website' | null>(null);

  if (!isAuthenticated || !currentUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-[#FF9F1C]/20 flex items-center justify-center mx-auto text-2xl">
          🏃
        </div>
        <h2 className="text-xl font-bold text-[#141414]">Runner Profile</h2>
        <p className="text-xs text-neutral-600">
          Sign in or create an account to view and configure your club membership settings.
        </p>
        <button
          onClick={onOpenAuth}
          className="px-6 py-2.5 rounded-xl bg-[#FF9F1C] text-[#141414] font-bold text-xs shadow-sm hover:bg-[#e08914]"
        >
          Sign In / Join Club
        </button>
      </div>
    );
  }

  const handleSaveName = async () => {
    if (nameInput.trim()) {
      await updateProfile({ displayName: nameInput.trim() });
      setIsEditingName(false);
    }
  };

  const nextGoalId = currentUser.nextMonthGoalGroup || currentUser.currentGoalGroup;

  return (
    <div className="space-y-6 pb-24 md:pb-12 max-w-3xl mx-auto px-4 pt-5">
      {/* Profile Header Card */}
      <div className="p-6 rounded-3xl bg-white border border-neutral-200 shadow-xs flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
        <img
          src={
            currentUser.avatarUrl ||
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80'
          }
          alt={currentUser.displayName}
          className="w-20 h-20 rounded-full object-cover border-4 border-[#FF9F1C] shadow-sm shrink-0"
        />

        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="px-2.5 py-1 text-sm font-bold bg-[#FAF9F6] border border-neutral-300 rounded-lg"
                />
                <button
                  onClick={handleSaveName}
                  className="px-2.5 py-1 text-xs font-bold bg-[#141414] text-white rounded-lg"
                >
                  Save
                </button>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-black text-[#141414]">{currentUser.displayName}</h1>
                <button
                  onClick={() => setIsEditingName(true)}
                  className="p-1 text-neutral-400 hover:text-black"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {isAdmin && (
              <span className="px-2 py-0.5 rounded-full bg-[#141414] text-[#FFD600] font-black text-[10px] tracking-wide uppercase flex items-center gap-1">
                <Shield className="w-3 h-3" /> Club Admin
              </span>
            )}
          </div>

          <p className="text-xs text-neutral-500">{currentUser.email}</p>
          <p className="text-[11px] text-neutral-400">
            Member of {club.name} since {formatDateInIST(currentUser.joinedAt)}
          </p>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-300 text-neutral-600 hover:bg-neutral-100 text-xs font-semibold shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Monthly Distance Group Settings */}
      <div className="p-6 rounded-3xl bg-white border border-neutral-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#FF9F1C]" />
          <div>
            <h2 className="text-sm font-bold text-[#141414]">Monthly Distance Goal Settings</h2>
            <p className="text-[11px] text-neutral-500">
              Current month remains stable; selections take effect next month.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Active Month (Locked) */}
          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-1">
            <span className="text-[10px] font-bold text-neutral-500 uppercase">
              Current Month (October 2026)
            </span>
            <p className="text-base font-black text-[#141414]">
              {DISTANCE_GROUPS[currentUser.currentGoalGroup].label}
            </p>
            <p className="text-[11px] text-neutral-500">
              {DISTANCE_GROUPS[currentUser.currentGoalGroup].description}
            </p>
          </div>

          {/* Next Month Selector */}
          <div className="p-4 rounded-2xl bg-[#FF9F1C]/10 border border-[#FF9F1C]/30 space-y-2">
            <span className="text-[10px] font-bold text-[#141414] uppercase">
              Next Month Selection (November 2026)
            </span>
            <div className="space-y-1.5">
              {(Object.keys(DISTANCE_GROUPS) as DistanceGroupId[]).map((gid) => {
                const isSelected = nextGoalId === gid;
                return (
                  <button
                    key={gid}
                    onClick={() => selectNextMonthGoal(gid)}
                    className={`w-full py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-between border ${
                      isSelected
                        ? 'border-[#FF9F1C] bg-[#FF9F1C] text-[#141414]'
                        : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700'
                    }`}
                  >
                    <span>{DISTANCE_GROUPS[gid].label}</span>
                    {isSelected && <span className="text-[10px] font-black">Active</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Strava Connection Card */}
      <div className="p-6 rounded-3xl bg-white border border-neutral-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#FC5200]" />
            <div>
              <h2 className="text-sm font-bold text-[#141414]">Strava OAuth Integration</h2>
              <p className="text-[11px] text-neutral-500">
                Official Strava OAuth 2.0 connection for automatic run import
              </p>
            </div>
          </div>
        </div>

        {stravaStatus?.connected ? (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-emerald-950">
                  Connected to {stravaStatus.athleteName}
                </p>
                <p className="text-[11px] text-neutral-600">
                  October 2026 running activities active in leaderboards.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  setIsSyncing(true);
                  await syncStravaRuns();
                  setIsSyncing(false);
                }}
                disabled={isSyncing}
                className="px-3 py-1.5 rounded-xl bg-[#FF9F1C] hover:bg-[#e08914] text-[#141414] text-xs font-bold transition active:scale-95 disabled:opacity-50"
              >
                {isSyncing ? 'Syncing...' : 'Sync Runs'}
              </button>
              <button
                onClick={async () => {
                  if (window.confirm('Are you sure you want to remove your Strava sync? Your club membership and past synced runs will remain, but automatic sync will stop.')) {
                    await disconnectStrava();
                  }
                }}
                className="px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-xs text-red-600 font-bold transition active:scale-95 flex items-center gap-1.5"
                title="Remove Strava sync connection"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Remove Strava Sync</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-600 flex items-center justify-between gap-3">
            <span>No Strava account connected yet.</span>
            <button
              onClick={connectStravaOAuth}
              className="px-4 py-2 rounded-xl bg-[#FC5200] hover:bg-[#e04800] text-white text-xs font-bold transition active:scale-95 shadow-sm flex items-center gap-1.5"
            >
              <Activity className="w-4 h-4 stroke-[2.5]" />
              <span>Connect with Strava</span>
            </button>
          </div>
        )}

        {/* Strava Developer Callback Domain Settings Helper */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Strava API Callback Domain Setup</span>
            </div>
            <a
              href="https://www.strava.com/settings/api"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-bold text-[#FC5200] hover:underline flex items-center gap-1"
            >
              <span>Strava Settings</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <p className="text-[11px] text-neutral-600 leading-relaxed">
            Strava requires the <strong>Authorization Callback Domain</strong> in your Strava API settings to strictly match the domain of this application. Do not include <code className="bg-amber-100 px-1 py-0.5 rounded text-[10px]">https://</code> or trailing slashes in the callback domain.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-white border border-neutral-200">
              <span className="text-[10px] font-bold uppercase text-neutral-400 block mb-1">
                Authorization Callback Domain
              </span>
              <div className="flex items-center justify-between gap-2">
                <code className="text-[11px] font-mono font-bold text-neutral-800 truncate">
                  {typeof window !== 'undefined' ? window.location.hostname : 'run.app'}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.hostname);
                    setCopiedField('domain');
                    setTimeout(() => setCopiedField(null), 2000);
                  }}
                  className="px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200 text-[10px] font-bold text-neutral-700 shrink-0 transition"
                >
                  {copiedField === 'domain' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-white border border-neutral-200">
              <span className="text-[10px] font-bold uppercase text-neutral-400 block mb-1">
                Website
              </span>
              <div className="flex items-center justify-between gap-2">
                <code className="text-[11px] font-mono font-bold text-neutral-800 truncate">
                  {typeof window !== 'undefined' ? window.location.origin : 'run.app'}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.origin);
                    setCopiedField('website');
                    setTimeout(() => setCopiedField(null), 2000);
                  }}
                  className="px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200 text-[10px] font-bold text-neutral-700 shrink-0 transition"
                >
                  {copiedField === 'website' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PWA Installation & Offline Mode */}
      <div className="p-6 rounded-3xl bg-white border border-neutral-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-[#FF9F1C]" />
            <div>
              <h2 className="text-sm font-bold text-[#141414]">Install Web App (PWA)</h2>
              <p className="text-[11px] text-neutral-500">
                Install on your home screen for quick access during runs
              </p>
            </div>
          </div>

          <PWAInstallButton />
        </div>
        <p className="text-xs text-neutral-600 leading-relaxed">
          The app works offline to display your cached runs and monthly standings. Connect to the internet to sync new Strava runs.
        </p>
      </div>

      {/* Club Membership Actions */}
      <div className="p-6 rounded-3xl bg-white border border-neutral-200 shadow-xs space-y-3">
        <h2 className="text-sm font-bold text-[#141414]">Account & Membership</h2>

        {/* Sign Out Option */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-xs font-bold text-neutral-800">Sign Out</p>
            <p className="text-[11px] text-neutral-500">
              Log out of your current session on this device.
            </p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold transition active:scale-95 border border-neutral-200"
          >
            <LogOut className="w-3.5 h-3.5 text-neutral-600" />
            <span>Sign Out</span>
          </button>
        </div>

        {!isAdmin && (
          <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
            <div>
              <p className="text-xs font-bold text-neutral-800">Admin Privileges</p>
              <p className="text-[11px] text-neutral-500">
                Bootstrap to Admin mode for testing member and club controls.
              </p>
            </div>
            <button
              onClick={bootstrapAdmin}
              className="px-3 py-1.5 rounded-xl bg-[#141414] text-[#FFD600] text-xs font-bold hover:bg-neutral-800"
            >
              Enable Admin Mode
            </button>
          </div>
        )}

        <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-red-600">Leave {club.name}</p>
            <p className="text-[11px] text-neutral-500">
              Removes your profile and rankings from the active club directory.
            </p>
          </div>

          {showLeaveConfirm ? (
            <div className="flex items-center gap-2">
              <button
                onClick={leaveClub}
                className="px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold"
              >
                Confirm Leave
              </button>
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="px-3 py-1.5 rounded-xl bg-neutral-200 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="px-3 py-1.5 rounded-xl border border-red-300 text-red-600 text-xs font-bold hover:bg-red-50"
            >
              Leave Club
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
