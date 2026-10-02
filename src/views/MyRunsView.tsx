import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  formatKm,
  formatPace,
  formatDuration,
  formatDateInIST,
  formatDateTimeInIST,
  calculatePaceSecondsPerKm,
  toKmNumber,
  isEligible5K,
  isEligible10K,
  parseActivityDate,
} from '../lib/dateUtils';
import {
  Footprints,
  RefreshCw,
  Activity,
  AlertCircle,
  Calendar,
  Clock,
  Zap,
  Tag,
  Ban,
  CheckCircle,
  PlusCircle,
  Unlink,
} from 'lucide-react';

interface MyRunsViewProps {}

export const MyRunsView: React.FC<MyRunsViewProps> = () => {
  const {
    currentUser,
    activities,
    stravaStatus,
    syncStravaRuns,
    connectStravaOAuth,
    disconnectStrava,
  } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  // User's runs sorted newest first
  const myRuns = currentUser
    ? activities
        .filter((a) => a.memberId === currentUser.id)
        .sort((a, b) => parseActivityDate(b).getTime() - parseActivityDate(a).getTime())
    : [];

  const totalDistanceMeters = myRuns.reduce((sum, a) => sum + (a.isExcluded ? 0 : a.distanceMeters), 0);
  const totalKm = toKmNumber(totalDistanceMeters);
  const totalMovingSec = myRuns.reduce((sum, a) => sum + (a.isExcluded ? 0 : a.movingTimeSeconds), 0);
  const overallAvgPace = calculatePaceSecondsPerKm(totalMovingSec, totalDistanceMeters);

  const handleSync = async () => {
    if (!stravaStatus?.connected) {
      await connectStravaOAuth();
      return;
    }
    setIsSyncing(true);
    setSyncMsg(null);
    const res = await syncStravaRuns();
    if (res.success) {
      setSyncMsg(`Sync complete! ${res.imported || 0} activities refreshed.`);
      setTimeout(() => setSyncMsg(null), 4000);
    } else {
      setSyncMsg(res.error || 'Sync failed.');
    }
    setIsSyncing(false);
  };

  return (
    <div className="space-y-5 pb-24 md:pb-12 max-w-4xl mx-auto px-4 pt-5">
      {/* Header & Sync Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-neutral-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Footprints className="w-5 h-5 text-[#FF9F1C]" />
            <h1 className="text-xl md:text-2xl font-black text-[#141414] tracking-tight">
              My Running Activities
            </h1>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Imported from Strava starting October 1, 2026 (Asia/Kolkata)
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {stravaStatus?.connected ? (
            <>
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="px-4 py-2 rounded-xl bg-[#FF9F1C] hover:bg-[#e08914] text-[#141414] text-xs font-bold transition active:scale-95 shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Runs'}</span>
              </button>
              <button
                onClick={async () => {
                  if (window.confirm('Are you sure you want to remove your Strava sync?')) {
                    await disconnectStrava();
                  }
                }}
                className="px-3 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition active:scale-95 flex items-center gap-1.5"
                title="Remove Strava sync connection"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Remove Strava Sync</span>
              </button>
            </>
          ) : (
            <button
              onClick={handleSync}
              className="px-4 py-2.5 rounded-xl bg-[#FC5200] hover:bg-[#e04800] text-white text-xs font-bold transition active:scale-95 shadow-xs flex items-center gap-1.5"
            >
              <Activity className="w-4 h-4 stroke-[2.5]" />
              <span>Connect Strava</span>
            </button>
          )}
        </div>
      </div>

      {syncMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{syncMsg}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-xs">
          <span className="text-[11px] font-semibold text-neutral-500 uppercase block">Total Runs</span>
          <span className="text-2xl font-black text-[#141414]">{myRuns.length}</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-xs">
          <span className="text-[11px] font-semibold text-neutral-500 uppercase block">Total Distance</span>
          <span className="text-2xl font-black text-[#141414]">
            {totalKm.toFixed(1)} <span className="text-xs font-normal text-neutral-500">km</span>
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-xs">
          <span className="text-[11px] font-semibold text-neutral-500 uppercase block">Average Pace</span>
          <span className="text-2xl font-black text-[#141414]">
            {formatPace(overallAvgPace)}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-xs">
          <span className="text-[11px] font-semibold text-neutral-500 uppercase block">Moving Time</span>
          <span className="text-2xl font-black text-[#141414]">
            {formatDuration(totalMovingSec)}
          </span>
        </div>
      </div>

      {/* Activity List */}
      <div className="space-y-3">
        {myRuns.length === 0 ? (
          <div className="p-10 text-center bg-white rounded-3xl border border-dashed border-neutral-300 space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#FF9F1C]/20 flex items-center justify-center text-xl mx-auto">
              🏃
            </div>
            <h3 className="text-sm font-bold text-[#141414]">No Runs Imported Yet</h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Connect your Strava account or paste your access token to import your October 2026 activities.
            </p>
            <button
              onClick={connectStravaOAuth}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FC5200] hover:bg-[#e04800] text-white font-bold text-xs shadow-xs transition active:scale-95"
            >
              <Activity className="w-4 h-4 stroke-[2.5]" />
              <span>Connect with Strava (OAuth)</span>
            </button>
          </div>
        ) : (
          myRuns.map((act) => {
            const paceSec = calculatePaceSecondsPerKm(act.movingTimeSeconds, act.distanceMeters);
            const is5kQual = isEligible5K(act.distanceMeters, act.manual, act.isExcluded);
            const is10kQual = isEligible10K(act.distanceMeters, act.manual, act.isExcluded);

            return (
              <div
                key={act.id}
                className={`p-4 rounded-2xl border transition shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  act.isExcluded
                    ? 'bg-neutral-100 border-red-300 opacity-80'
                    : 'bg-white border-neutral-200 hover:border-neutral-300'
                }`}
              >
                {/* Left Info */}
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-sm text-[#141414] truncate">
                      {act.title}
                    </span>

                    {/* Sport Badge */}
                    <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 text-[10px] font-bold">
                      {act.sportType}
                    </span>

                    {/* Pace Qualification Badges */}
                    {is5kQual && (
                      <span className="px-2 py-0.5 rounded-md bg-[#FF9F1C]/20 text-[#141414] text-[10px] font-black">
                        5K Pace Eligible
                      </span>
                    )}
                    {is10kQual && (
                      <span className="px-2 py-0.5 rounded-md bg-[#FFD600]/30 text-[#141414] text-[10px] font-black">
                        10K Pace Eligible
                      </span>
                    )}

                    {act.manual && (
                      <span className="px-2 py-0.5 rounded-md bg-neutral-200 text-neutral-600 text-[10px]">
                        Manual
                      </span>
                    )}

                    {act.isExcluded && (
                      <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-700 text-[10px] font-bold flex items-center gap-1">
                        <Ban className="w-3 h-3" /> Excluded from rankings
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-neutral-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-neutral-400" />
                    <span>{formatDateTimeInIST(act)} (Asia/Kolkata)</span>
                  </p>

                  {act.isExcluded && act.exclusionReason && (
                    <div className="p-2 rounded-lg bg-red-50 text-[11px] text-red-700 border border-red-200 mt-1">
                      <strong>Admin note:</strong> {act.exclusionReason}
                    </div>
                  )}
                </div>

                {/* Right Metrics */}
                <div className="grid grid-cols-3 md:flex md:items-center gap-3 md:gap-6 pt-2 md:pt-0 border-t md:border-t-0 border-neutral-100 shrink-0 text-center md:text-right">
                  <div>
                    <span className="text-[10px] text-neutral-400 block uppercase">Distance</span>
                    <span className="text-sm md:text-base font-black text-[#141414]">
                      {formatKm(act.distanceMeters, 2)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-neutral-400 block uppercase">Pace</span>
                    <span className="text-sm md:text-base font-black text-[#141414]">
                      {formatPace(paceSec)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-neutral-400 block uppercase">Moving Time</span>
                    <span className="text-sm md:text-base font-black text-[#141414]">
                      {formatDuration(act.movingTimeSeconds)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
