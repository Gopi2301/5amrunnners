# Supabase Database Setup & Admin Bootstrap Instructions

## 1. Prerequisites
- Create a project on [Supabase.com](https://supabase.com).
- Note your Project URL, Public Anon Key, and Secret Service Role Key from **Project Settings > API**.

## 2. Run Database Migrations
1. In your Supabase Dashboard, open the **SQL Editor**.
2. Click **New query**.
3. Copy the entire contents of `/supabase/migrations/20261001_initial_schema.sql` and run it.
4. This will create:
   - `profiles` table with automatic signup triggers
   - `clubs` table with seeded "Kolkata Runners Club"
   - `club_memberships` table
   - `monthly_goals` table
   - `strava_connections` table (server-only with restricted RLS)
   - `activities` table with indexes
   - Row Level Security (RLS) policies enforcing role isolation and activity privacy.

## 3. Environment Variables
Add the following to your `.env` file (or AI Studio runtime secrets):

```env
# Client-side Supabase credentials
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Server-side Supabase credentials (never exposed to browser)
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Strava API Application
STRAVA_CLIENT_ID=your-strava-client-id
STRAVA_CLIENT_SECRET=your-strava-client-secret
APP_URL=https://your-preview-url.run.app
```

## 4. Bootstrapping the First Admin
To bootstrap your user account as the club administrator:
1. Sign up through the application UI or Supabase Auth.
2. In the Supabase Dashboard, open **Table Editor > profiles**.
3. Locate your user row and change `role` from `'MEMBER'` to `'ADMIN'`.
4. Alternatively, run the following SQL query in the Supabase SQL editor:
   ```sql
   UPDATE public.profiles
   SET role = 'ADMIN'
   WHERE id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');
   ```
5. In the web app, you can also click **"Sign In as Admin"** or **"Enable Admin Mode"** on the Profile screen to test admin capabilities immediately during preview!
