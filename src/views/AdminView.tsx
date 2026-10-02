import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { DISTANCE_GROUPS, MemberStatus } from '../types';
import { formatKm, formatPace, formatDateInIST } from '../lib/dateUtils';
import {
  ShieldCheck,
  Users,
  Settings,
  Ban,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Edit,
  Save,
  Activity as ActivityIcon,
  Unlink,
} from 'lucide-react';

export const AdminView: React.FC = () => {
  const {
    currentUser,
    isAdmin,
    club,
    members,
    activities,
    adminUpdateClub,
    adminUpdateMemberStatus,
    adminExcludeActivity,
    adminReinstateActivity,
    adminRemoveStravaSync,
  } = useAuth();

  const [adminTab, setAdminTab] = useState<'members' | 'settings' | 'activities'>('members');
  const [adminToast, setAdminToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [removingStravaId, setRemovingStravaId] = useState<string | null>(null);

  // Club settings state
  const [clubName, setClubName] = useState(club.name);
  const [clubDesc, setClubDesc] = useState(club.description);
  const [clubImg, setClubImg] = useState(club.imageUrl);
  const [clubNotice, setClubNotice] = useState(club.announcement || '');
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  // Activity exclusion state
  const [excludingId, setExcludingId] = useState<string | null>(null);
  const [exclusionReason, setExclusionReason] = useState('');

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto text-xl font-bold">
          !
        </div>
        <h2 className="text-lg font-bold text-[#141414]">Access Denied</h2>
        <p className="text-xs text-neutral-600">
          Admin authorization is required to access club management controls.
        </p>
      </div>
    );
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await adminUpdateClub({
      name: clubName.trim(),
      description: clubDesc.trim(),
      imageUrl: clubImg.trim(),
      announcement: clubNotice.trim(),
    });
    setSettingsSuccess('Club settings updated successfully!');
    setTimeout(() => setSettingsSuccess(null), 3500);
  };

  const handleConfirmExclusion = async (actId: string) => {
    if (!exclusionReason.trim()) return;
    await adminExcludeActivity(actId, exclusionReason.trim());
    setExcludingId(null);
    setExclusionReason('');
  };

  return (
    <div className="space-y-5 pb-24 md:pb-12 max-w-4xl mx-auto px-4 pt-5">
      {/* Admin Title Header */}
      <div className="bg-white p-5 rounded-3xl border border-neutral-200 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#141414] text-[#FFD600] flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#141414] tracking-tight">Admin Controls</h1>
            <p className="text-xs text-neutral-500">
              Manage {club.name} membership, settings, and activity integrity.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-neutral-200/80 p-1.5 rounded-2xl text-xs font-bold max-w-md mx-auto">
        <button
          onClick={() => setAdminTab('members')}
          className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
            adminTab === 'members' ? 'bg-[#141414] text-[#FAF9F6] shadow-sm' : 'text-neutral-600'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Members ({members.length})</span>
        </button>
        <button
          onClick={() => setAdminTab('activities')}
          className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
            adminTab === 'activities' ? 'bg-[#141414] text-[#FAF9F6] shadow-sm' : 'text-neutral-600'
          }`}
        >
          <ActivityIcon className="w-3.5 h-3.5" />
          <span>Activity Integrity</span>
        </button>
        <button
          onClick={() => setAdminTab('settings')}
          className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
            adminTab === 'settings' ? 'bg-[#141414] text-[#FAF9F6] shadow-sm' : 'text-neutral-600'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Club Settings</span>
        </button>
      </div>

      {/* ---------------- MEMBERS TAB ---------------- */}
      {adminTab === 'members' && (
        <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-xs divide-y divide-neutral-100">
          <div className="p-4 bg-neutral-50 border-b border-neutral-200 text-xs font-bold text-neutral-700">
            Registered Members & Distance Groups
          </div>

          {adminToast && (
            <div
              className={`p-3 mx-4 my-3 rounded-xl text-xs font-bold flex items-center justify-between gap-2 shadow-xs ${
                adminToast.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-800'
                  : 'bg-red-500/10 border border-red-500/30 text-red-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{adminToast.message}</span>
              </div>
              <button
                onClick={() => setAdminToast(null)}
                className="text-neutral-400 hover:text-neutral-700 text-xs px-1"
              >
                ✕
              </button>
            </div>
          )}

          {members.map((member) => {
            const isSelf = member.id === currentUser?.id;
            return (
              <div
                key={member.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/50"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={member.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                    alt={member.displayName}
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-[#141414]">{member.displayName}</span>
                      {member.role === 'ADMIN' && (
                        <span className="px-1.5 py-0.5 rounded bg-[#141414] text-[#FFD600] font-black text-[9px]">
                          ADMIN
                        </span>
                      )}
                      {member.status === 'suspended' && (
                        <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold text-[9px]">
                          SUSPENDED
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-500">{member.email}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] font-semibold text-[#FF9F1C] bg-[#FF9F1C]/10 px-2 py-0.5 rounded">
                        Group: {DISTANCE_GROUPS[member.currentGoalGroup]?.label || member.currentGoalGroup}
                      </span>
                      {member.hasStravaSync ? (
                        <span className="text-[10px] font-bold text-[#FC5200] bg-[#FC5200]/10 px-2 py-0.5 rounded flex items-center gap-1">
                          <ActivityIcon className="w-2.5 h-2.5" />
                          <span>Strava: {member.stravaAthleteName || 'Connected'}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded">
                          Strava: Disconnected
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status action buttons */}
                <div className="flex items-center gap-2 self-end sm:self-center flex-wrap justify-end">
                  {/* Remove Strava Sync Button */}
                  {member.hasStravaSync && (
                    <button
                      onClick={async () => {
                        if (
                          window.confirm(
                            `Remove Strava sync for ${member.displayName}? This will disconnect their Strava account without deleting their member profile or past runs.`
                          )
                        ) {
                          setRemovingStravaId(member.id);
                          const res = await adminRemoveStravaSync(member.id);
                          setRemovingStravaId(null);
                          if (res.success) {
                            setAdminToast({
                              message: `Strava sync removed for ${member.displayName}.`,
                              type: 'success',
                            });
                            setTimeout(() => setAdminToast(null), 3500);
                          } else {
                            setAdminToast({
                              message: res.error || 'Failed to remove Strava sync.',
                              type: 'error',
                            });
                            setTimeout(() => setAdminToast(null), 4000);
                          }
                        }
                      }}
                      disabled={removingStravaId === member.id}
                      className="px-2.5 py-1.5 rounded-xl border border-orange-200 bg-orange-50 hover:bg-orange-100 text-[#FC5200] text-xs font-bold transition active:scale-95 flex items-center gap-1 shadow-xs disabled:opacity-50"
                      title="Remove Strava sync for this member"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">
                        {removingStravaId === member.id ? 'Removing...' : 'Remove Strava Sync'}
                      </span>
                      <span className="sm:hidden">
                        {removingStravaId === member.id ? '...' : 'Remove Sync'}
                      </span>
                    </button>
                  )}

                  {!isSelf && (
                    <>
                      {member.status === 'suspended' ? (
                        <button
                          onClick={() => adminUpdateMemberStatus(member.id, 'active')}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 flex items-center gap-1 shadow-xs"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reinstate</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => adminUpdateMemberStatus(member.id, 'suspended')}
                          className="px-3 py-1.5 rounded-xl border border-amber-400 text-amber-800 text-xs font-bold hover:bg-amber-50 flex items-center gap-1 shadow-xs"
                        >
                          <Ban className="w-3 h-3" />
                          <span>Suspend</span>
                        </button>
                      )}

                      <button
                        onClick={() => adminUpdateMemberStatus(member.id, 'removed')}
                        className="px-2.5 py-1.5 rounded-xl border border-red-300 text-red-600 text-xs font-bold hover:bg-red-50 shadow-xs"
                        title="Remove member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---------------- ACTIVITY INTEGRITY TAB ---------------- */}
      {adminTab === 'activities' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900">
            <p className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-[#FF9F1C]" />
              Activity Moderation & Fair Play
            </p>
            <p className="text-[11px] text-neutral-700 mt-1">
              Admins can exclude invalid, motor-assisted, or misclassified activities from club rankings with a recorded reason. Excluded runs are automatically removed from distance and pace rankings.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-xs divide-y divide-neutral-100">
            {activities.map((act) => {
              const runner = members.find((m) => m.id === act.memberId);
              const isExcluding = excludingId === act.id;

              return (
                <div key={act.id} className="p-4 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#141414]">{act.title}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 font-semibold">
                          {act.sportType}
                        </span>
                        {act.isExcluded && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold">
                            Excluded
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500">
                        Runner: {runner?.displayName} • {formatKm(act.distanceMeters, 2)} • {formatDateInIST(act)}
                      </p>
                    </div>

                    <div>
                      {act.isExcluded ? (
                        <button
                          onClick={() => adminReinstateActivity(act.id)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reinstate Run</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setExcludingId(act.id);
                            setExclusionReason('');
                          }}
                          className="px-3 py-1.5 rounded-xl border border-red-300 text-red-600 text-xs font-bold hover:bg-red-50 flex items-center gap-1"
                        >
                          <Ban className="w-3 h-3" />
                          <span>Exclude</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {act.isExcluded && act.exclusionReason && (
                    <p className="text-[11px] text-red-700 bg-red-50 p-2 rounded-lg border border-red-200">
                      <strong>Recorded reason:</strong> {act.exclusionReason}
                    </p>
                  )}

                  {/* Exclude modal prompt */}
                  {isExcluding && (
                    <div className="mt-2 p-3 rounded-xl bg-neutral-50 border border-neutral-300 space-y-2">
                      <label className="block text-xs font-bold text-neutral-700">
                        Reason for excluding this activity (Mandatory):
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. GPS spike, bicycle ride tagged as run, inaccurate distance"
                        value={exclusionReason}
                        onChange={(e) => setExclusionReason(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-hidden focus:border-[#FF9F1C]"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setExcludingId(null)}
                          className="px-3 py-1 rounded-lg text-xs font-semibold text-neutral-600"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleConfirmExclusion(act.id)}
                          disabled={!exclusionReason.trim()}
                          className="px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-bold disabled:opacity-50"
                        >
                          Confirm Exclusion
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------- SETTINGS TAB ---------------- */}
      {adminTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="p-6 rounded-3xl bg-white border border-neutral-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-[#141414]">Club Profile & Notice Board</h2>

          {settingsSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>{settingsSuccess}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">Club Name</label>
            <input
              type="text"
              required
              value={clubName}
              onChange={(e) => setClubName(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-[#FAF9F6] border border-neutral-300 rounded-xl focus:outline-hidden focus:border-[#FF9F1C]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">Motto / Description</label>
            <textarea
              rows={3}
              required
              value={clubDesc}
              onChange={(e) => setClubDesc(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-[#FAF9F6] border border-neutral-300 rounded-xl focus:outline-hidden focus:border-[#FF9F1C]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">Cover Image URL</label>
            <input
              type="url"
              required
              value={clubImg}
              onChange={(e) => setClubImg(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-[#FAF9F6] border border-neutral-300 rounded-xl focus:outline-hidden focus:border-[#FF9F1C]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Active Month Announcement / Notice
            </label>
            <input
              type="text"
              value={clubNotice}
              onChange={(e) => setClubNotice(e.target.value)}
              placeholder="e.g. October 2026 challenge is live! Group runs every Saturday at 6:00 AM."
              className="w-full px-3.5 py-2 text-xs bg-[#FAF9F6] border border-neutral-300 rounded-xl focus:outline-hidden focus:border-[#FF9F1C]"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-[#141414] text-[#FAF9F6] hover:bg-neutral-800 font-bold text-xs transition active:scale-98 flex items-center justify-center gap-2"
          >
            <Save className="w-3.5 h-3.5 text-[#FFD600]" />
            <span>Save Club Settings</span>
          </button>
        </form>
      )}
    </div>
  );
};
