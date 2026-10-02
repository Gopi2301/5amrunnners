// Type definitions for Kolkata Runners Club

export type Role = 'MEMBER' | 'ADMIN';
export type MemberStatus = 'active' | 'suspended' | 'removed';

export type DistanceGroupId = 'up_to_50' | 'up_to_75' | 'above_100';

export interface DistanceGroupConfig {
  id: DistanceGroupId;
  label: 'Up to 50 km' | 'Up to 75 km' | 'Above 100 km';
  targetKm: number;
  description: string;
}

export const DISTANCE_GROUPS: Record<DistanceGroupId, DistanceGroupConfig> = {
  up_to_50: {
    id: 'up_to_50',
    label: 'Up to 50 km',
    targetKm: 50,
    description: 'Targeting up to 50 km this month (~12 km/week)',
  },
  up_to_75: {
    id: 'up_to_75',
    label: 'Up to 75 km',
    targetKm: 75,
    description: 'Targeting up to 75 km this month (~18 km/week)',
  },
  above_100: {
    id: 'above_100',
    label: 'Above 100 km',
    targetKm: 100,
    description: 'Targeting 100+ km milestone this month (Endurance & Marathon)',
  },
};

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: Role;
  status: MemberStatus;
  joinedAt: string;
  bio?: string;
  currentGoalGroup: DistanceGroupId;
  nextMonthGoalGroup?: DistanceGroupId;
  hasStravaSync?: boolean;
  stravaAthleteName?: string;
  stravaLastSyncedAt?: string;
}

export interface Club {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  announcement?: string;
  location: string;
  foundedYear: number;
}

export interface MonthlyGoal {
  id: string;
  userId: string;
  monthKey: string; // e.g. "2026-10"
  goalGroup: DistanceGroupId;
  updatedAt: string;
}

export interface Activity {
  id: string;
  stravaActivityId?: string;
  memberId: string;
  athleteId?: number;
  title: string;
  sportType: 'Run' | 'TrailRun' | 'VirtualRun' | string;
  distanceMeters: number;
  movingTimeSeconds: number;
  elapsedTimeSeconds: number;
  startDateLocal: string; // ISO string in Asia/Kolkata
  startDateTimestamp: number; // Unix epoch ms
  manual: boolean;
  visibility: 'everyone' | 'followers_only' | 'only_me' | string;
  isExcluded: boolean;
  exclusionReason?: string;
  averageSpeedMps?: number;
}

export interface StravaConnection {
  connected?: boolean;
  memberId: string;
  athleteId: number;
  athleteName: string;
  athleteAvatar?: string;
  lastSyncedAt?: string;
  syncStatus?: 'idle' | 'syncing' | 'error' | 'success';
  syncError?: string;
}

export interface DistanceLeaderboardEntry {
  rank: number;
  memberId: string;
  displayName: string;
  avatarUrl?: string;
  goalGroup: DistanceGroupId;
  totalKm: number;
  totalRuns: number;
  isCurrentUser: boolean;
  progressPercent: number;
}

export interface PaceLeaderboardEntry {
  rank: number;
  memberId: string;
  displayName: string;
  avatarUrl?: string;
  activityId: string;
  distanceKm: number;
  movingTimeSeconds: number;
  paceSecondsPerKm: number;
  paceFormatted: string; // e.g. "4:42 /km"
  activityDate: string;
  isCurrentUser: boolean;
}
