import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { DISTANCE_GROUPS, DistanceGroupId } from '../types';
import {
  toKmNumber,
  formatKm,
  formatPace,
  formatDateInIST,
  calculatePaceSecondsPerKm,
  isEligible5K,
  isEligible10K,
  formatMonthName,
  isActivityInMonth,
} from '../lib/dateUtils';
import {
  Trophy,
  Timer,
  ChevronDown,
  Info,
  Calendar,
  AlertCircle,
  Footprints,
} from 'lucide-react';

export const LeaderboardView: React.FC = () => {
  const {
    club,
    currentUser,
    members,
    activities,
    activeMonthKey,
    setActiveMonthKey,
  } = useAuth();

  const [leaderboardTab, setLeaderboardTab] = useState<'distance' | 'pace'>('distance');
  const [selectedDistanceGroup, setSelectedDistanceGroup] = useState<DistanceGroupId>('up_to_50');
  const [selectedPaceFilter, setSelectedPaceFilter] = useState<'5k' | '10k'>('5k');

  // Month selector options
  const monthOptions = [
    { key: '2026-10', label: 'October 2026 (Launch Month)' },
    { key: '2026-09', label: 'September 2026' },
    { key: '2026-08', label: 'August 2026' },
  ];

  // Active eligible members (exclude suspended or removed)
  const eligibleMembers = useMemo(() => {
    return members.filter((m) => m.status === 'active');
  }, [members]);

  // Filter activities by current selected month precisely in Asia/Kolkata and non-excluded
  const monthActivities = useMemo(() => {
    return activities.filter((act) => {
      if (act.isExcluded) return false;
      return isActivityInMonth(act, activeMonthKey);
    });
  }, [activities, activeMonthKey]);

  // -------------------------------------------------------------
  // DISTANCE LEADERBOARD LOGIC
  // -------------------------------------------------------------
  const distanceRankings = useMemo(() => {
    // Filter members in the selected group
    const groupMembers = eligibleMembers.filter(
      (m) => m.currentGoalGroup === selectedDistanceGroup
    );

    const rows = groupMembers.map((member) => {
      const runnerActivities = monthActivities.filter((a) => a.memberId === member.id);
      const totalMeters = runnerActivities.reduce((sum, a) => sum + a.distanceMeters, 0);
      const totalKm = toKmNumber(totalMeters);

      return {
        member,
        totalKm,
        totalRuns: runnerActivities.length,
        isCurrentUser: currentUser?.id === member.id,
      };
    });

    // Sort descending by totalKm
    rows.sort((a, b) => b.totalKm - a.totalKm);

    // Compute shared ranks
    let currentRank = 1;
    return rows.map((row, index, arr) => {
      if (index > 0 && row.totalKm < arr[index - 1].totalKm) {
        currentRank = index + 1;
      }
      return {
        ...row,
        rank: currentRank,
      };
    });
  }, [eligibleMembers, monthActivities, selectedDistanceGroup, currentUser?.id]);

  // -------------------------------------------------------------
  // PACE LEADERBOARD LOGIC (5K & 10K)
  // -------------------------------------------------------------
  const paceRankings = useMemo(() => {
    // Compare all eligible club members, regardless of distance goal group
    const rows = eligibleMembers.map((member) => {
      const runnerActivities = monthActivities.filter((a) => a.memberId === member.id);

      // Find all qualifying runs for this member
      const qualifyingRuns = runnerActivities.filter((act) => {
        if (selectedPaceFilter === '5k') {
          return isEligible5K(act.distanceMeters, act.manual, act.isExcluded);
        } else {
          return isEligible10K(act.distanceMeters, act.manual, act.isExcluded);
        }
      });

      if (qualifyingRuns.length === 0) {
        return {
          member,
          bestRun: null,
          paceSecPerKm: Infinity,
          isCurrentUser: currentUser?.id === member.id,
        };
      }

      // Find run with lowest pace (best effort)
      let bestAct = qualifyingRuns[0];
      let bestPace = calculatePaceSecondsPerKm(bestAct.movingTimeSeconds, bestAct.distanceMeters);

      for (let i = 1; i < qualifyingRuns.length; i++) {
        const act = qualifyingRuns[i];
        const p = calculatePaceSecondsPerKm(act.movingTimeSeconds, act.distanceMeters);
        if (p < bestPace) {
          bestPace = p;
          bestAct = act;
        }
      }

      return {
        member,
        bestRun: bestAct,
        paceSecPerKm: bestPace,
        isCurrentUser: currentUser?.id === member.id,
      };
    });

    // Sort: qualifying runs with lower pace first, then non-qualifying
    rows.sort((a, b) => {
      if (a.bestRun && !b.bestRun) return -1;
      if (!a.bestRun && b.bestRun) return 1;
      return a.paceSecPerKm - b.paceSecPerKm;
    });

    // Compute shared ranks based on formatted pace
    let currentRank = 1;
    return rows.map((row, index, arr) => {
      if (!row.bestRun) {
        return { ...row, rank: null };
      }
      if (index > 0 && arr[index - 1].bestRun) {
        const prevPace = formatPace(arr[index - 1].paceSecPerKm);
        const thisPace = formatPace(row.paceSecPerKm);
        if (thisPace !== prevPace) {
          currentRank = index + 1;
        }
      }
      return {
        ...row,
        rank: currentRank,
      };
    });
  }, [eligibleMembers, monthActivities, selectedPaceFilter, currentUser?.id]);

  return (
    <div className="space-y-5 pb-24 md:pb-12 max-w-4xl mx-auto px-4 pt-5">
      {/* Page Header and Month Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-neutral-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF9F1C] animate-pulse" />
            <h1 className="text-xl md:text-2xl font-black text-[#141414] tracking-tight">
              Club Leaderboards
            </h1>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Official {club.name} monthly rankings (Asia/Kolkata timezone)
          </p>
        </div>

        {/* Month Dropdown */}
        <div className="relative">
          <label htmlFor="month-selector" className="sr-only">Select Month</label>
          <select
            id="month-selector"
            value={activeMonthKey}
            onChange={(e) => setActiveMonthKey(e.target.value)}
            className="appearance-none bg-[#FAF9F6] border border-neutral-300 font-bold text-xs text-[#141414] py-2.5 pl-3.5 pr-8 rounded-xl focus:outline-hidden focus:border-[#FF9F1C] cursor-pointer"
          >
            {monthOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 absolute right-2.5 top-3 text-neutral-500 pointer-events-none" />
        </div>
      </div>

      {/* Main Tabs: Distance vs Pace */}
      <div className="flex bg-neutral-200/80 p-1.5 rounded-2xl text-xs font-extrabold max-w-sm mx-auto">
        <button
          onClick={() => setLeaderboardTab('distance')}
          className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center gap-2 ${
            leaderboardTab === 'distance'
              ? 'bg-[#141414] text-[#FAF9F6] shadow-sm'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Footprints className="w-4 h-4" />
          <span>Distance</span>
        </button>
        <button
          onClick={() => setLeaderboardTab('pace')}
          className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center gap-2 ${
            leaderboardTab === 'pace'
              ? 'bg-[#141414] text-[#FAF9F6] shadow-sm'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Timer className="w-4 h-4" />
          <span>Pace (5K / 10K)</span>
        </button>
      </div>

      {/* ----------------- DISTANCE TAB CONTENT ----------------- */}
      {leaderboardTab === 'distance' && (
        <div className="space-y-4">
          {/* Distance Group Filter Chips (Exact three labels) */}
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(DISTANCE_GROUPS) as DistanceGroupId[]).map((groupId) => {
              const cfg = DISTANCE_GROUPS[groupId];
              const isSelected = selectedDistanceGroup === groupId;
              return (
                <button
                  key={groupId}
                  onClick={() => setSelectedDistanceGroup(groupId)}
                  className={`py-3 px-2 rounded-2xl border text-center transition ${
                    isSelected
                      ? 'bg-[#FF9F1C] border-[#FF9F1C] text-[#141414] font-extrabold shadow-sm'
                      : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300 font-semibold'
                  }`}
                >
                  <p className="text-xs md:text-sm">{cfg.label}</p>
                  <span className={`text-[10px] hidden sm:block mt-0.5 ${isSelected ? 'text-[#141414]/80' : 'text-neutral-400'}`}>
                    {cfg.targetKm} km milestone
                  </span>
                </button>
              );
            })}
          </div>

          {/* Group Explanation Note */}
          <div className="p-3.5 rounded-xl bg-white border border-neutral-200 text-xs text-neutral-600 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-[#FF9F1C] shrink-0 mt-0.5" />
            <p>
              Showing members who selected <strong>{DISTANCE_GROUPS[selectedDistanceGroup].label}</strong> for {formatMonthName(activeMonthKey)}.
              Distance continues counting beyond target. Members are not moved automatically between groups.
            </p>
          </div>

          {/* Distance Rankings List */}
          <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-xs divide-y divide-neutral-100">
            {distanceRankings.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500">
                No active runners enrolled in this group for {formatMonthName(activeMonthKey)}.
              </div>
            ) : (
              distanceRankings.map((row) => (
                <div
                  key={row.member.id}
                  className={`p-4 flex items-center justify-between gap-3 transition ${
                    row.isCurrentUser
                      ? 'bg-[#FF9F1C]/15 border-l-4 border-l-[#FF9F1C]'
                      : 'hover:bg-neutral-50/80'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Rank Indicator */}
                    <div className="w-7 text-center shrink-0">
                      {row.rank === 1 ? (
                        <div className="w-7 h-7 rounded-full bg-[#FFD600] text-[#141414] font-black text-xs flex items-center justify-center mx-auto shadow-xs">
                          1
                        </div>
                      ) : row.rank === 2 ? (
                        <div className="w-7 h-7 rounded-full bg-neutral-200 text-neutral-800 font-black text-xs flex items-center justify-center mx-auto">
                          2
                        </div>
                      ) : row.rank === 3 ? (
                        <div className="w-7 h-7 rounded-full bg-[#FF9F1C]/30 text-[#141414] font-black text-xs flex items-center justify-center mx-auto">
                          3
                        </div>
                      ) : (
                        <span className="font-extrabold text-xs text-neutral-400">
                          #{row.rank}
                        </span>
                      )}
                    </div>

                    {/* Avatar & Name */}
                    <img
                      src={
                        row.member.avatarUrl ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
                      }
                      alt={row.member.displayName}
                      className="w-10 h-10 rounded-full object-cover shrink-0 border border-neutral-200"
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-xs md:text-sm text-[#141414] truncate">
                          {row.member.displayName}
                        </span>
                        {row.isCurrentUser && (
                          <span className="px-1.5 py-0.2 rounded bg-[#141414] text-[#FAF9F6] text-[9px] font-black uppercase">
                            YOU
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500">
                        {row.totalRuns > 0
                          ? `${row.totalRuns} ${row.totalRuns === 1 ? 'run' : 'runs'} this month`
                          : 'No runs yet'}
                      </p>
                    </div>
                  </div>

                  {/* Distance Total */}
                  <div className="text-right shrink-0">
                    {row.totalKm > 0 ? (
                      <div>
                        <span className="text-sm md:text-base font-black text-[#141414]">
                          {row.totalKm.toFixed(1)}
                        </span>
                        <span className="text-xs font-bold text-neutral-500 ml-1">km</span>
                      </div>
                    ) : (
                      <span className="text-xs text-neutral-400 italic">No runs yet</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ----------------- PACE TAB CONTENT ----------------- */}
      {leaderboardTab === 'pace' && (
        <div className="space-y-4">
          {/* Pace Filter Chips: 5K Pace and 10K Pace */}
          <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
            <button
              onClick={() => setSelectedPaceFilter('5k')}
              className={`py-3 px-4 rounded-2xl border text-center transition ${
                selectedPaceFilter === '5k'
                  ? 'bg-[#FF9F1C] border-[#FF9F1C] text-[#141414] font-extrabold shadow-sm'
                  : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300 font-semibold'
              }`}
            >
              <p className="text-xs md:text-sm">5K Run Pace</p>
              <span className={`text-[10px] ${selectedPaceFilter === '5k' ? 'text-[#141414]/80' : 'text-neutral-400'}`}>
                Distance: 5.00 km to 5.25 km
              </span>
            </button>
            <button
              onClick={() => setSelectedPaceFilter('10k')}
              className={`py-3 px-4 rounded-2xl border text-center transition ${
                selectedPaceFilter === '10k'
                  ? 'bg-[#FF9F1C] border-[#FF9F1C] text-[#141414] font-extrabold shadow-sm'
                  : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300 font-semibold'
              }`}
            >
              <p className="text-xs md:text-sm">10K Run Pace</p>
              <span className={`text-[10px] ${selectedPaceFilter === '10k' ? 'text-[#141414]/80' : 'text-neutral-400'}`}>
                Distance: 10.00 km to 10.50 km
              </span>
            </button>
          </div>

          {/* Qualifying Eligibility Rule Explanation (Mandatory per specification) */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-950 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <Info className="w-4 h-4 text-[#FF9F1C]" />
              <span>
                {selectedPaceFilter === '5k' ? '5K Run Pace' : '10K Run Pace'} Qualifying Rules
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-neutral-700">
              {selectedPaceFilter === '5k' ? (
                <>
                  Eligibility: Whole-run activities with distance from <strong>5.00 km to 5.25 km</strong> during {formatMonthName(activeMonthKey)}.
                  Ranked by average moving pace (moving time in seconds ÷ distance in km). Lower pace ranks higher.
                </>
              ) : (
                <>
                  Eligibility: Whole-run activities with distance from <strong>10.00 km to 10.50 km</strong> during {formatMonthName(activeMonthKey)}.
                  Ranked by average moving pace (moving time in seconds ÷ distance in km). Lower pace ranks higher.
                </>
              )}
            </p>
            <p className="text-[10px] text-neutral-500 italic pt-0.5">
              * Note: These are whole-run averages, not extracted split personal bests. Longer runs do not qualify merely because they contain 5 km or 10 km. Manual entries and admin-excluded runs are excluded.
            </p>
          </div>

          {/* Pace Rankings List */}
          <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-xs divide-y divide-neutral-100">
            {paceRankings.map((row) => (
              <div
                key={row.member.id}
                className={`p-4 flex items-center justify-between gap-3 transition ${
                  row.isCurrentUser
                    ? 'bg-[#FF9F1C]/15 border-l-4 border-l-[#FF9F1C]'
                    : 'hover:bg-neutral-50/80'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Rank */}
                  <div className="w-7 text-center shrink-0">
                    {row.rank === 1 ? (
                      <div className="w-7 h-7 rounded-full bg-[#FFD600] text-[#141414] font-black text-xs flex items-center justify-center mx-auto shadow-xs">
                        1
                      </div>
                    ) : row.rank === 2 ? (
                      <div className="w-7 h-7 rounded-full bg-neutral-200 text-neutral-800 font-black text-xs flex items-center justify-center mx-auto">
                        2
                      </div>
                    ) : row.rank === 3 ? (
                      <div className="w-7 h-7 rounded-full bg-[#FF9F1C]/30 text-[#141414] font-black text-xs flex items-center justify-center mx-auto">
                        3
                      </div>
                    ) : row.rank ? (
                      <span className="font-extrabold text-xs text-neutral-400">
                        #{row.rank}
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-300">-</span>
                    )}
                  </div>

                  {/* Avatar & Name */}
                  <img
                    src={
                      row.member.avatarUrl ||
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
                    }
                    alt={row.member.displayName}
                    className="w-10 h-10 rounded-full object-cover shrink-0 border border-neutral-200"
                  />

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-xs md:text-sm text-[#141414] truncate">
                        {row.member.displayName}
                      </span>
                      {row.isCurrentUser && (
                        <span className="px-1.5 py-0.2 rounded bg-[#141414] text-[#FAF9F6] text-[9px] font-black uppercase">
                          YOU
                        </span>
                      )}
                    </div>
                    {row.bestRun ? (
                      <p className="text-[11px] text-neutral-500">
                        {formatKm(row.bestRun.distanceMeters, 2)} • {formatDateInIST(row.bestRun.startDateLocal)}
                      </p>
                    ) : (
                      <p className="text-[11px] text-neutral-400 italic">No qualifying run</p>
                    )}
                  </div>
                </div>

                {/* Pace Result */}
                <div className="text-right shrink-0">
                  {row.bestRun ? (
                    <div>
                      <span className="text-sm md:text-base font-black text-[#141414]">
                        {formatPace(row.paceSecPerKm)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-neutral-400 italic">No qualifying run</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
