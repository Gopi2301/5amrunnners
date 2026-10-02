import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  UserProfile,
  Club,
  Activity,
  MonthlyGoal,
  DistanceGroupId,
  StravaConnection,
  MemberStatus,
} from '../types';
import {
  INITIAL_CLUB,
  INITIAL_MEMBERS,
  INITIAL_ACTIVITIES,
  INITIAL_MONTHLY_GOALS,
} from '../lib/mockData';
import { STORAGE_KEYS, supabase, isSupabaseConfigured } from '../lib/supabase';
import { LAUNCH_MONTH_KEY } from '../lib/dateUtils';

interface AuthContextType {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuspended: boolean;
  isLoading: boolean;
  club: Club;
  members: UserProfile[];
  activities: Activity[];
  monthlyGoals: MonthlyGoal[];
  stravaStatus: StravaConnection | null;
  activeMonthKey: string;
  setActiveMonthKey: (key: string) => void;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  signup: (
    email: string,
    password: string,
    displayName: string,
    goalGroup: DistanceGroupId,
    avatarUrl?: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  selectNextMonthGoal: (goalGroup: DistanceGroupId) => Promise<void>;
  leaveClub: () => Promise<void>;
  joinClub: (goalGroup: DistanceGroupId) => Promise<void>;
  bootstrapAdmin: () => Promise<void>;
  connectStravaOAuth: () => Promise<{ success: boolean; error?: string }>;
  syncStravaRuns: () => Promise<{ success: boolean; imported?: number; error?: string }>;
  testStravaToken: (token: string) => Promise<{ success: boolean; athlete?: any; imported?: number; error?: string }>;
  disconnectStrava: () => Promise<void>;
  adminRemoveStravaSync: (memberId: string) => Promise<{ success: boolean; error?: string }>;
  adminUpdateClub: (updates: Partial<Club>) => Promise<void>;
  adminUpdateMemberStatus: (memberId: string, status: MemberStatus) => Promise<void>;
  adminExcludeActivity: (activityId: string, reason: string) => Promise<void>;
  adminReinstateActivity: (activityId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse saved user:', e);
    }
    // Default to the first member (admin) or null
    return null;
  });

  const [club, setClub] = useState<Club>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CLUB);
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_CLUB;
  });

  const [members, setMembers] = useState<UserProfile[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MEMBERS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_MEMBERS;
  });

  const [activities, setActivities] = useState<Activity[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACTIVITIES);
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_ACTIVITIES;
  });

  const [monthlyGoals, setMonthlyGoals] = useState<MonthlyGoal[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.GOALS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_MONTHLY_GOALS;
  });

  const [stravaStatus, setStravaStatus] = useState<StravaConnection | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STRAVA_CONN);
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  const [activeMonthKey, setActiveMonthKey] = useState<string>(LAUNCH_MONTH_KEY);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Initial load from live Supabase PostgreSQL DB via server API
  useEffect(() => {
    fetch('/api/db/data')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          if (data.club) setClub(data.club);
          if (data.members && data.members.length > 0) setMembers(data.members);
          if (data.activities && data.activities.length > 0) setActivities(data.activities);
          if (data.monthlyGoals && data.monthlyGoals.length > 0) setMonthlyGoals(data.monthlyGoals);
        }
      })
      .catch((err) => console.warn('Could not fetch DB data on load:', err));
  }, []);

  // Sync to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(activities));
  }, [activities]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(monthlyGoals));
  }, [monthlyGoals]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CLUB, JSON.stringify(club));
  }, [club]);

  useEffect(() => {
    if (stravaStatus) {
      localStorage.setItem(STORAGE_KEYS.STRAVA_CONN, JSON.stringify(stravaStatus));
    } else {
      localStorage.removeItem(STORAGE_KEYS.STRAVA_CONN);
    }
  }, [stravaStatus]);

  // Sync Strava connection state from server on mount or user change
  useEffect(() => {
    if (!currentUser) return;
    fetch(`/api/strava/status/${currentUser.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.connected) {
          setStravaStatus({
            connected: true,
            memberId: currentUser.id,
            athleteId: data.athleteId,
            athleteName: data.athleteName,
            athleteAvatar: data.athleteAvatar,
            lastSyncedAt: data.lastSyncedAt,
            syncStatus: data.syncStatus || 'idle',
            syncError: data.syncError,
          });
        }
      })
      .catch(() => {});
  }, [currentUser?.id]);

  // 1. Sign In
  const login = async (email: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) {
        return { success: false, error: 'Please enter a valid email address.' };
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: password || '' }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Login failed.' };
      }

      setCurrentUser(data.member);
      setMembers((prev) => {
        const idx = prev.findIndex((m) => m.id === data.member.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = data.member;
          return updated;
        }
        return [...prev, data.member];
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed.' };
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Sign Up & Onboarding
  const signup = async (
    email: string,
    password: string,
    displayName: string,
    goalGroup: DistanceGroupId,
    avatarUrl?: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = displayName.trim();

      if (!cleanEmail || !cleanEmail.includes('@')) {
        return { success: false, error: 'Valid email is required.' };
      }
      if (!cleanName) {
        return { success: false, error: 'Display name is required.' };
      }
      if (!password || password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters.' };
      }

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          displayName: cleanName,
          goalGroup,
          avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanName)}`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Signup failed.' };
      }

      const newMember: UserProfile = data.member;

      const newGoal: MonthlyGoal = {
        id: `g_${Date.now()}`,
        userId: newMember.id,
        monthKey: LAUNCH_MONTH_KEY,
        goalGroup: newMember.currentGoalGroup,
        updatedAt: new Date().toISOString(),
      };

      setMembers((prev) => {
        const existingIdx = prev.findIndex((m) => m.id === newMember.id || m.email === newMember.email);
        if (existingIdx >= 0) {
          const copy = [...prev];
          copy[existingIdx] = newMember;
          return copy;
        }
        return [...prev, newMember];
      });

      setMonthlyGoals((prev) => [...prev, newGoal]);
      setCurrentUser(newMember);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Signup failed.' };
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Logout
  const logout = async () => {
    setCurrentUser(null);
    setStravaStatus(null);
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.STRAVA_CONN);
  };

  // 4. Password Reset
  const resetPassword = async (email: string) => {
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      return {
        success: res.ok,
        message: data.message || data.error || 'Password reset requested.',
      };
    } catch (e: any) {
      return {
        success: false,
        message: e.message || 'Error sending password reset.',
      };
    }
  };

  // 5. Update Profile
  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!currentUser) return;
    // Disallow role or status escalation from profile edit
    const safeUpdates = { ...updates };
    delete safeUpdates.role;
    delete safeUpdates.status;
    delete safeUpdates.id;

    const updatedUser = { ...currentUser, ...safeUpdates };
    setCurrentUser(updatedUser);
    setMembers((prev) => prev.map((m) => (m.id === currentUser.id ? updatedUser : m)));
  };

  // 6. Select Next Month Goal (Current month remains stable!)
  const selectNextMonthGoal = async (goalGroup: DistanceGroupId) => {
    if (!currentUser) return;
    const updatedUser = { ...currentUser, nextMonthGoalGroup: goalGroup };
    setCurrentUser(updatedUser);
    setMembers((prev) => prev.map((m) => (m.id === currentUser.id ? updatedUser : m)));
    fetch('/api/profile/next-month-goal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, goalGroup }),
    }).catch(() => {});
  };

  // 7. Leave Club
  const leaveClub = async () => {
    if (!currentUser) return;
    setMembers((prev) => prev.filter((m) => m.id !== currentUser.id));
    setCurrentUser(null);
    setStravaStatus(null);
  };

  // 8. Join Club
  const joinClub = async (goalGroup: DistanceGroupId) => {
    if (!currentUser) return;
    const updatedUser: UserProfile = {
      ...currentUser,
      status: 'active',
      currentGoalGroup: goalGroup,
      nextMonthGoalGroup: goalGroup,
    };
    setCurrentUser(updatedUser);
    setMembers((prev) => {
      const idx = prev.findIndex((m) => m.id === currentUser.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updatedUser;
        return copy;
      }
      return [...prev, updatedUser];
    });
  };

  // 9. Bootstrap Admin (documented server-side setup step)
  const bootstrapAdmin = async () => {
    const adminUser = members.find((m) => m.role === 'ADMIN');
    if (adminUser) {
      setCurrentUser(adminUser);
    } else if (currentUser) {
      const elevated: UserProfile = { ...currentUser, role: 'ADMIN', status: 'active' };
      setCurrentUser(elevated);
      setMembers((prev) => prev.map((m) => (m.id === currentUser.id ? elevated : m)));
    }
  };

  // 10. Test Strava Token (Milestone 2 - user's supplied token)
  const testStravaToken = async (
    token: string
  ): Promise<{ success: boolean; athlete?: any; imported?: number; error?: string }> => {
    if (!currentUser) {
      return { success: false, error: 'You must be signed in to connect Strava.' };
    }

    try {
      const res = await fetch('/api/strava/test-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: token.trim(),
          memberId: currentUser.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to verify Strava token.' };
      }

      setStravaStatus({
        connected: true,
        memberId: currentUser.id,
        athleteId: data.athlete.id,
        athleteName: data.athlete.name,
        athleteAvatar: data.athlete.avatar,
        lastSyncedAt: new Date().toISOString(),
        syncStatus: 'success',
      });

      // If activities were returned, merge into state
      if (data.syncSummary?.runs && Array.isArray(data.syncSummary.runs)) {
        const newRuns: Activity[] = data.syncSummary.runs.map((r: any) => ({
          id: r.id,
          stravaActivityId: r.stravaActivityId,
          memberId: currentUser.id,
          athleteId: r.athleteId,
          title: r.title,
          sportType: r.sportType,
          distanceMeters: r.distanceMeters,
          movingTimeSeconds: r.movingTimeSeconds,
          elapsedTimeSeconds: r.elapsedTimeSeconds,
          startDateLocal: r.startDateLocal,
          startDateTimestamp: r.startDateTimestamp,
          manual: r.manual,
          visibility: r.visibility,
          isExcluded: r.isExcluded,
          exclusionReason: r.exclusionReason,
        }));

        setActivities((prev) => {
          const otherRuns = prev.filter((a) => a.memberId !== currentUser.id);
          return [...otherRuns, ...newRuns];
        });
      }

      return {
        success: true,
        athlete: data.athlete,
        imported: data.syncSummary?.imported || 0,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error verifying Strava token.' };
    }
  };

  // 11. Sync Strava Runs
  const syncStravaRuns = async (): Promise<{ success: boolean; imported?: number; error?: string }> => {
    if (!currentUser) return { success: false, error: 'Sign in required.' };

    try {
      setStravaStatus((prev) => (prev ? { ...prev, syncStatus: 'syncing' } : null));

      const res = await fetch('/api/strava/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: currentUser.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStravaStatus((prev) =>
          prev ? { ...prev, syncStatus: 'error', syncError: data.error } : null
        );
        return { success: false, error: data.error || 'Sync failed.' };
      }

      setStravaStatus((prev) =>
        prev
          ? {
              ...prev,
              lastSyncedAt: data.lastSyncedAt,
              syncStatus: 'success',
              syncError: undefined,
            }
          : null
      );

      if (data.runs && Array.isArray(data.runs)) {
        const updatedRuns: Activity[] = data.runs.map((r: any) => ({
          id: String(r.id),
          stravaActivityId: String(r.stravaActivityId || r.strava_activity_id || r.id),
          memberId: currentUser.id,
          athleteId: Number(r.athleteId || r.athlete_id || 0),
          title: r.title || 'Running Activity',
          sportType: r.sportType || r.sport_type || 'Run',
          distanceMeters: Number(r.distanceMeters || r.distance_meters || 0),
          movingTimeSeconds: Number(r.movingTimeSeconds || r.moving_time_seconds || 0),
          elapsedTimeSeconds: Number(r.elapsedTimeSeconds || r.elapsed_time_seconds || 0),
          startDateLocal: r.startDateLocal || r.start_date_local,
          startDateTimestamp: Number(r.startDateTimestamp || r.start_date_timestamp || 0),
          manual: Boolean(r.manual),
          visibility: r.visibility || 'everyone',
          isExcluded: Boolean(r.isExcluded || r.is_excluded),
          exclusionReason: r.exclusionReason || r.exclusion_reason,
        }));

        setActivities((prev) => {
          const updatedStravaIds = new Set(updatedRuns.map((u) => u.stravaActivityId));
          const updatedIds = new Set(updatedRuns.map((u) => u.id));
          const otherRuns = prev.filter(
            (a) =>
              a.memberId !== currentUser.id &&
              !updatedStravaIds.has(a.stravaActivityId) &&
              !updatedIds.has(a.id)
          );
          return [...otherRuns, ...updatedRuns];
        });
      }

      return { success: true, imported: data.imported };
    } catch (err: any) {
      setStravaStatus((prev) =>
        prev ? { ...prev, syncStatus: 'error', syncError: err.message } : null
      );
      return { success: false, error: err.message };
    }
  };

  // 12. Connect Strava OAuth (Direct Flow - No Setup Modal)
  const connectStravaOAuth = async (): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) {
      return { success: false, error: 'Please sign in to connect your Strava account.' };
    }

    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const res = await fetch(
        `/api/strava/auth-url?memberId=${encodeURIComponent(currentUser.id)}&origin=${encodeURIComponent(origin)}`
      );
      const data = await res.json();

      if (!data.configured || !data.url) {
        return { success: false, error: data.message || 'Strava OAuth is not configured on the server.' };
      }

      // Open OAuth provider URL directly in popup
      const authWindow = window.open(
        data.url,
        'strava_oauth_popup',
        'width=600,height=750,left=200,top=100'
      );

      if (!authWindow) {
        return { success: false, error: 'Popup was blocked by your browser. Please allow popups.' };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to start Strava authorization.' };
    }
  };

  // Global listener for Strava OAuth popup callback message
  useEffect(() => {
    const handleOAuthMessage = async (event: MessageEvent) => {
      const origin = event.origin;
      const isAllowedOrigin =
        origin === window.location.origin ||
        origin.endsWith('.run.app') ||
        origin.endsWith('.ai.studio') ||
        origin.includes('5amrunners.ai.studio') ||
        origin.includes('localhost') ||
        origin.includes('0.0.0.0');

      if (!isAllowedOrigin) {
        return;
      }

      if (event.data?.type === 'STRAVA_AUTH_RESULT') {
        const { code, error } = event.data;
        if (error) {
          console.error('Strava OAuth authorization failed:', error);
          setStravaStatus((prev) =>
            prev ? { ...prev, syncStatus: 'error', syncError: error } : null
          );
          return;
        }

        if (code && currentUser) {
          try {
            const resp = await fetch('/api/strava/exchange', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code, memberId: currentUser.id }),
            });
            const data = await resp.json();
            if (resp.ok) {
              setStravaStatus({
                connected: true,
                memberId: currentUser.id,
                athleteId: data.athleteId,
                athleteName: data.athleteName,
                athleteAvatar: data.athleteAvatar,
                lastSyncedAt: new Date().toISOString(),
                syncStatus: 'idle',
              });
              await syncStravaRuns();
            }
          } catch (e) {
            console.error('Exchange error:', e);
          }
        }
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [currentUser]);

  // 13. Disconnect Strava (User action)
  const disconnectStrava = async () => {
    if (!currentUser) return;
    try {
      await fetch('/api/strava/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: currentUser.id }),
      });
      setStravaStatus(null);
      setMembers((prev) =>
        prev.map((m) =>
          m.id === currentUser.id
            ? { ...m, hasStravaSync: false, stravaAthleteName: undefined, stravaLastSyncedAt: undefined }
            : m
        )
      );
    } catch (e) {
      console.error('Failed to disconnect Strava:', e);
    }
  };

  // 13b. Admin: Remove Strava Sync for specific member
  const adminRemoveStravaSync = async (memberId: string): Promise<{ success: boolean; error?: string }> => {
    if (currentUser?.role !== 'ADMIN') {
      return { success: false, error: 'Admin authorization required.' };
    }
    try {
      const res = await fetch('/api/admin/remove-strava-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, adminRole: 'ADMIN' }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return { success: false, error: errData.error || 'Failed to remove Strava sync.' };
      }

      // Update members state
      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId
            ? { ...m, hasStravaSync: false, stravaAthleteName: undefined, stravaLastSyncedAt: undefined }
            : m
        )
      );

      // If modifying own account
      if (currentUser.id === memberId) {
        setStravaStatus(null);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error removing Strava sync.' };
    }
  };

  // 13. Admin: Update Club Settings
  const adminUpdateClub = async (updates: Partial<Club>) => {
    if (currentUser?.role !== 'ADMIN') throw new Error('Admin authorization required.');
    setClub((prev) => ({ ...prev, ...updates }));
  };

  // 14. Admin: Member Status Management (Suspend, Reinstate, Remove)
  const adminUpdateMemberStatus = async (memberId: string, status: MemberStatus) => {
    if (currentUser?.role !== 'ADMIN') throw new Error('Admin authorization required.');
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, status } : m))
    );
    if (currentUser.id === memberId) {
      setCurrentUser((prev) => (prev ? { ...prev, status } : null));
    }
  };

  // 15. Admin: Exclude Invalid Activity with Reason
  const adminExcludeActivity = async (activityId: string, reason: string) => {
    if (currentUser?.role !== 'ADMIN') throw new Error('Admin authorization required.');
    if (!reason.trim()) throw new Error('Exclusion reason is required.');

    setActivities((prev) =>
      prev.map((a) =>
        a.id === activityId
          ? { ...a, isExcluded: true, exclusionReason: reason.trim() }
          : a
      )
    );

    // Call server endpoint
    await fetch('/api/admin/exclude-activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activityId,
        reason: reason.trim(),
        adminRole: 'ADMIN',
      }),
    }).catch(() => {});
  };

  // 16. Admin: Reinstate Excluded Activity
  const adminReinstateActivity = async (activityId: string) => {
    if (currentUser?.role !== 'ADMIN') throw new Error('Admin authorization required.');

    setActivities((prev) =>
      prev.map((a) =>
        a.id === activityId
          ? { ...a, isExcluded: false, exclusionReason: undefined }
          : a
      )
    );

    await fetch('/api/admin/reinstate-activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activityId,
        adminRole: 'ADMIN',
      }),
    }).catch(() => {});
  };

  const isAdmin = currentUser?.role === 'ADMIN';
  const isSuspended = currentUser?.status === 'suspended';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        isAdmin,
        isSuspended,
        isLoading,
        club,
        members,
        activities,
        monthlyGoals,
        stravaStatus,
        activeMonthKey,
        setActiveMonthKey,
        login,
        signup,
        logout,
        resetPassword,
        updateProfile,
        selectNextMonthGoal,
        leaveClub,
        joinClub,
        bootstrapAdmin,
        connectStravaOAuth,
        syncStravaRuns,
        testStravaToken,
        disconnectStrava,
        adminRemoveStravaSync,
        adminUpdateClub,
        adminUpdateMemberStatus,
        adminExcludeActivity,
        adminReinstateActivity,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
