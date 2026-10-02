import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { DISTANCE_GROUPS, DistanceGroupId } from '../types';
import {
  formatKm,
  formatPace,
  formatDuration,
  formatDateInIST,
  formatDateTimeInIST,
  calculatePaceSecondsPerKm,
  toKmNumber,
  formatMonthName,
  isActivityInLastDays,
  parseActivityDate,
} from '../lib/dateUtils';
import {
  Trophy,
  Activity,
  Flame,
  ChevronRight,
  RefreshCw,
  Calendar,
  AlertTriangle,
  Award,
  Sparkles,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
}) => {
  const {
    currentUser,
    club,
    members,
    activities,
    stravaStatus,
    activeMonthKey,
    syncStravaRuns,
    connectStravaOAuth,
    disconnectStrava,
    selectNextMonthGoal,
    isSuspended,
  } = useAuth();

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // 1. Rolling Last 30 Days Activities (non-excluded)
  const last30DaysActivities = activities.filter((act) => {
    return !act.isExcluded && isActivityInLastDays(act, 30);
  });

  // Calculate current user's distance and stats in the last 30 days
  const user30DaysActivities = currentUser
    ? last30DaysActivities.filter((a) => a.memberId === currentUser.id)
    : [];

  const user30DaysDistanceMeters = user30DaysActivities.reduce((acc, a) => acc + a.distanceMeters, 0);
  const user30DaysKm = toKmNumber(user30DaysDistanceMeters);
  const user30DaysMovingSeconds = user30DaysActivities.reduce((acc, a) => acc + a.movingTimeSeconds, 0);
  const user30DaysAvgPaceSec = calculatePaceSecondsPerKm(user30DaysMovingSeconds, user30DaysDistanceMeters);

  // Current user's goal group
  const userGoalGroupId: DistanceGroupId = currentUser?.currentGoalGroup || 'up_to_50';
  const goalConfig = DISTANCE_GROUPS[userGoalGroupId];

  // Calculate group rank based on last 30 days performance
  const groupMembers = members.filter(
    (m) => m.status === 'active' && m.currentGoalGroup === userGoalGroupId
  );

  const memberDistances = groupMembers.map((m) => {
    const totalDist = last30DaysActivities
      .filter((a) => a.memberId === m.id)
      .reduce((sum, a) => sum + a.distanceMeters, 0);
    return {
      memberId: m.id,
      totalKm: toKmNumber(totalDist),
    };
  });

  // Sort descending
  memberDistances.sort((a, b) => b.totalKm - a.totalKm);

  // Determine user rank (shared rank for equal totals)
  let userRank = 1;
  let currentGroupRankIndex = 1;
  for (let i = 0; i < memberDistances.length; i++) {
    if (i > 0 && memberDistances[i].totalKm < memberDistances[i - 1].totalKm) {
      userRank = i + 1;
    }
    if (currentUser && memberDistances[i].memberId === currentUser.id) {
      currentGroupRankIndex = userRank;
      break;
    }
  }

  // Progress display logic:
  // For "Up to 50 km" and "Up to 75 km": show progress toward 50km/75km
  // For "Above 100 km": show accumulated distance and the 100 km milestone
  const targetKm = goalConfig.targetKm;
  const progressPercent =
    userGoalGroupId === 'above_100'
      ? Math.min(100, Math.round((user30DaysKm / 100) * 100))
      : Math.min(100, Math.round((user30DaysKm / targetKm) * 100));

  const handleSyncClick = async () => {
    if (!stravaStatus?.connected) {
      await connectStravaOAuth();
      return;
    }
    setIsSyncing(true);
    setSyncFeedback(null);
    const res = await syncStravaRuns();
    if (res.success) {
      setSyncFeedback(`Synced ${res.imported || 0} activities!`);
      setTimeout(() => setSyncFeedback(null), 3000);
    } else {
      setSyncFeedback(res.error || 'Sync failed');
    }
    setIsSyncing(false);
  };

  return (
    <div className="space-y-5 pb-24 md:pb-12 max-w-5xl mx-auto px-4 pt-5">
      {/* Suspended Alert */}
      {isSuspended && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-600 text-xs">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p>
            Your membership is currently suspended by an admin. You cannot participate in active rankings or sync new runs until reinstated.
          </p>
        </div>
      )}

      {/* Club Banner Header */}
      <div className="relative rounded-3xl overflow-hidden bg-[#141414] text-[#FAF9F6] border border-neutral-800 shadow-md">
        <div className="absolute inset-0 opacity-25 mix-blend-overlay">
          <img
            src={club.imageUrl}
            alt={club.name}
            className="w-full h-full object-cover object-center"
          />
        </div>
        <div className="relative p-5 md:p-7 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-[#FF9F1C] text-[#141414] font-bold text-[10px] tracking-wide uppercase">
                Active Month: {formatMonthName(activeMonthKey)}
              </span>
              <span className="text-xs text-neutral-300">
                {members.filter((m) => m.status === 'active').length} Active Runners
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[#FAF9F6]">
              {club.name}
            </h1>
            <p className="text-xs md:text-sm text-neutral-300 leading-relaxed">
              {club.description}
            </p>
            {club.announcement && (
              <div className="mt-2.5 px-3 py-1.5 rounded-xl bg-neutral-900/80 border border-neutral-700/60 text-[11px] text-[#FFD600] flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 shrink-0 text-[#FFD600]" />
                <span className="truncate">{club.announcement}</span>
              </div>
            )}
          </div>

          {/* Quick Strava Sync / Connect Action */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
            <button
              onClick={handleSyncClick}
              disabled={isSyncing}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition active:scale-95 disabled:opacity-50 ${
                stravaStatus?.connected
                  ? 'bg-[#FF9F1C] hover:bg-[#e08914] text-[#141414]'
                  : 'bg-[#FC5200] hover:bg-[#e04800] text-white'
              }`}
            >
              {stravaStatus?.connected ? (
                <>
                  <RefreshCw className={`w-3.5 h-3.5 stroke-[2.5] ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Syncing Strava...' : 'Sync Runs'}</span>
                </>
              ) : (
                <>
                  <Activity className="w-4 h-4 stroke-[2.5]" />
                  <span>Connect Strava</span>
                </>
              )}
            </button>

            {stravaStatus?.lastSyncedAt && (
              <p className="text-[10px] text-neutral-400 text-center">
                Last synced: {formatDateTimeInIST(stravaStatus.lastSyncedAt)}
              </p>
            )}

            {stravaStatus?.connected && (
              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm('Remove your Strava sync connection? Past synced runs will remain, but automatic sync will stop.')) {
                      await disconnectStrava();
                    }
                  }}
                  className="text-[10px] text-neutral-400 hover:text-red-400 underline transition cursor-pointer"
                >
                  Remove sync
                </button>
              </div>
            )}

            {syncFeedback && (
              <p className="text-[10px] text-[#FFD600] font-semibold text-center animate-fade-in">
                {syncFeedback}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Runner Monthly Stat Card */}
      {currentUser && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Main Distance Progress Card */}
          <div className="md:col-span-2 p-5 rounded-2xl bg-white border border-neutral-200 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                    My Last 30 Days Mileage
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#FF9F1C]/15 text-[#141414] font-bold text-[10px]">
                    {goalConfig.label}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold text-[10px]">
                    Rolling 30D
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl md:text-4xl font-black text-[#141414]">
                    {user30DaysKm.toFixed(1)}
                  </span>
                  <span className="text-sm font-bold text-neutral-500">km completed</span>
                </div>
              </div>

              {/* Group Rank Badge */}
              <div className="text-right">
                <span className="text-[11px] font-semibold text-neutral-500 block">
                  30D Group Rank
                </span>
                <div className="flex items-center justify-end gap-1 text-[#FF9F1C] font-black text-xl">
                  <Trophy className="w-4 h-4 text-[#FF9F1C]" />
                  <span>#{currentGroupRankIndex || 1}</span>
                  <span className="text-xs text-neutral-400 font-normal">
                    / {groupMembers.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Progress Bar / Milestone display */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span className="text-neutral-600">
                  {userGoalGroupId === 'above_100' ? (
                    user30DaysKm >= 100 ? (
                      <span className="text-emerald-600 font-bold flex items-center gap-1">
                        <Award className="w-3.5 h-3.5" /> 100 km Milestone Achieved! (+{(user30DaysKm - 100).toFixed(1)} km beyond)
                      </span>
                    ) : (
                      `${(100 - user30DaysKm).toFixed(1)} km to 100 km milestone`
                    )
                  ) : (
                    `${progressPercent}% towards ${goalConfig.label} target`
                  )}
                </span>
                <span className="text-neutral-800 font-bold">
                  {userGoalGroupId === 'above_100' ? '100 km Milestone' : `${targetKm} km Target`}
                </span>
              </div>

              <div className="w-full h-3 rounded-full bg-neutral-100 overflow-hidden p-0.5 border border-neutral-200">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    user30DaysKm >= targetKm ? 'bg-emerald-500' : 'bg-[#FF9F1C]'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Metric Row */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-100 text-center">
              <div>
                <span className="text-[11px] text-neutral-500 block">Runs (Last 30D)</span>
                <span className="text-sm font-extrabold text-[#141414]">{user30DaysActivities.length}</span>
              </div>
              <div>
                <span className="text-[11px] text-neutral-500 block">Avg Pace</span>
                <span className="text-sm font-extrabold text-[#141414]">
                  {formatPace(user30DaysAvgPaceSec)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-neutral-500 block">Moving Time</span>
                <span className="text-sm font-extrabold text-[#141414]">
                  {formatDuration(user30DaysMovingSeconds)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions & Next Month Goal Card */}
          <div className="p-5 rounded-2xl bg-[#FAF9F6] border border-neutral-200 shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-[#FF9F1C]" />
                <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                  Next Month Distance Goal
                </h3>
              </div>
              <p className="text-[11px] text-neutral-600 mb-3">
                Your selection applies to next month (November 2026). Current month assignment stays stable.
              </p>

              <div className="space-y-1.5">
                {(Object.keys(DISTANCE_GROUPS) as DistanceGroupId[]).map((gid) => {
                  const isCurrentNext = (currentUser.nextMonthGoalGroup || currentUser.currentGoalGroup) === gid;
                  return (
                    <button
                      key={gid}
                      onClick={() => selectNextMonthGoal(gid)}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-between border ${
                        isCurrentNext
                          ? 'border-[#FF9F1C] bg-[#FF9F1C]/15 text-[#141414]'
                          : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-600'
                      }`}
                    >
                      <span>{DISTANCE_GROUPS[gid].label}</span>
                      {isCurrentNext && (
                        <span className="text-[10px] font-extrabold text-[#FF9F1C]">Selected</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => onNavigate('leaderboards')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#141414] text-[#FAF9F6] text-xs font-bold hover:bg-neutral-800 transition active:scale-95"
            >
              <span>Explore Club Leaderboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Two Column Quick View: Group Top 3 & Recent Club Runs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Distance Leaders in your group */}
        <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#FF9F1C]" />
              <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                {goalConfig.label} Leaders
              </h3>
            </div>
            <button
              onClick={() => onNavigate('leaderboards')}
              className="text-xs font-bold text-[#FF9F1C] hover:underline flex items-center gap-0.5"
            >
              <span>View All</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="divide-y divide-neutral-100">
            {memberDistances.slice(0, 3).map((item, idx) => {
              const runner = members.find((m) => m.id === item.memberId);
              const isYou = currentUser?.id === item.memberId;
              return (
                <div
                  key={item.memberId}
                  className={`py-2.5 flex items-center justify-between gap-3 ${
                    isYou ? 'bg-[#FF9F1C]/10 -mx-2 px-2 rounded-xl' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 text-center font-bold text-xs text-neutral-400">
                      #{idx + 1}
                    </span>
                    <img
                      src={runner?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                      alt={runner?.displayName}
                      className="w-8 h-8 rounded-full object-cover shrink-0"
                    />
                    <div className="truncate">
                      <p className="text-xs font-bold text-[#141414] truncate">
                        {runner?.displayName} {isYou && <span className="text-[#FF9F1C]">(You)</span>}
                      </p>
                      <p className="text-[10px] text-neutral-500">
                        {item.totalKm > 0 ? `${item.totalKm} km (last 30 days)` : 'No runs yet'}
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-extrabold text-[#141414] shrink-0">
                    {item.totalKm} km
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Runs Feed */}
        <div className="p-5 rounded-2xl bg-white border border-neutral-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#FF9F1C]" />
              <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                Recent Club Activities
              </h3>
            </div>
            <button
              onClick={() => onNavigate('runs')}
              className="text-xs font-bold text-[#FF9F1C] hover:underline flex items-center gap-0.5"
            >
              <span>My Runs</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="divide-y divide-neutral-100">
            {[...activities]
              .filter((a) => !a.isExcluded)
              .sort((a, b) => parseActivityDate(b).getTime() - parseActivityDate(a).getTime())
              .slice(0, 4)
              .map((act) => {
                const runner = members.find((m) => m.id === act.memberId);
                const paceSec = calculatePaceSecondsPerKm(act.movingTimeSeconds, act.distanceMeters);
                return (
                  <div key={act.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0 text-[#141414] font-bold text-xs">
                        🏃
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-bold text-[#141414] truncate">{act.title}</p>
                        <p className="text-[10px] text-neutral-500 truncate">
                          {runner?.displayName} • {formatDateTimeInIST(act)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs font-extrabold text-[#141414]">
                        {formatKm(act.distanceMeters, 2)}
                      </p>
                      <p className="text-[10px] text-neutral-500">{formatPace(paceSec)}</p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
};
