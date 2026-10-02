import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'https://your-project.supabase.co' &&
    supabaseAnonKey !== 'your-anon-key'
  );
};

// Supabase client instance (or null if not configured)
export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

// Local storage key constants for reliable persistence
export const STORAGE_KEYS = {
  USER: 'krc_auth_user',
  MEMBERS: 'krc_members_list',
  ACTIVITIES: 'krc_activities_list',
  GOALS: 'krc_goals_list',
  CLUB: 'krc_club_data',
  STRAVA_CONN: 'krc_strava_conn',
};
