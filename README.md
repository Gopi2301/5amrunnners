# 🏃 Kolkata Runners Club

A community run club web application built for runners in Kolkata, featuring monthly distance goal leaderboards, 5K and 10K whole-run pace rankings, Strava activity import, admin governance, and an installable mobile-first PWA.

---

## 🎯 Milestone Checklist

- [x] **Milestone 1 — Authentication and Club**
  - [x] Email/password signup, login, logout, and password reset.
  - [x] Onboarding flow with runner display name, avatar, and starting distance group (`Up to 50 km`, `Up to 75 km`, `Above 100 km`).
  - [x] Role-based access control (`MEMBER` vs `ADMIN`) with server validation and database RLS.
  - [x] Seeded club entity (*Kolkata Runners Club*).
  - [x] Admin member management (suspend, reinstate, remove).
  - [x] Full PostgreSQL migration script in `/supabase/migrations/20261001_initial_schema.sql`.

- [x] **Milestone 2 — Real Strava Import**
  - [x] Direct personal access token import (`/api/strava/test-token`).
  - [x] Athlete identity verification prior to linking activities with runner account.
  - [x] Strict current-month window import (**October 1, 2026 00:00 Asia/Kolkata** through current time).
  - [x] Run type filtering: imports only "Run", "TrailRun", "VirtualRun" (excludes walks, hikes, bicycle rides).
  - [x] Deduplication and pagination by Strava activity ID.
  - [x] "My Runs" view with distance, duration, pace, and exclusion indicators.

- [x] **Milestone 3 — Multi-Member Strava OAuth**
  - [x] Per-member OAuth 2.0 popup integration (`/api/strava/auth-url` and `/auth/callback`).
  - [x] Secure `postMessage` cross-origin communication compliant with iframe environments.
  - [x] Server-side token storage (tokens and secrets never exposed in browser responses).
  - [x] Token refresh and rotation handling.
  - [x] Disconnect Strava option.
  - [x] Strava API term compliance notice & rate limit awareness (100 req / 15 min, 1000 req / day).

- [x] **Milestone 4 — Distance Leaderboards**
  - [x] Monthly distance calculations in `Asia/Kolkata` timezone.
  - [x] Three goal-group filters: **Up to 50 km**, **Up to 75 km**, **Above 100 km**.
  - [x] Highest-distance ranking with shared ranks for equal mileage.
  - [x] Highlighted personal row with group standing.
  - [x] Stable monthly group assignment (onboarding applies to current month; mid-month changes apply to next month).
  - [x] Month selector defaulting to October 2026.

- [x] **Milestone 5 — Pace Leaderboards and PWA**
  - [x] **5K Run Pace** filter (activities between 5.00 km and 5.25 km).
  - [x] **10K Run Pace** filter (activities between 10.00 km and 10.50 km).
  - [x] Whole-run average moving pace calculation (`moving_time ÷ distance_in_km`). Lower pace ranks higher.
  - [x] Transparent qualifying criteria notice and explanation on leaderboard.
  - [x] Exclusion of manual runs and admin-flagged runs from pace rankings.
  - [x] PWA manifest (`/public/manifest.webmanifest`), 192px/512px icons, service worker auto-update (`vite-plugin-pwa`).
  - [x] In-app install button with iOS Safari step-by-step guidance modal.
  - [x] Offline connectivity indicator and cached data fallback.

---

## 🛠 Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Motion.
- **Backend**: Express API server mounted with Vite dev server (`server.ts`).
- **Database / Auth**: Supabase Auth & Supabase PostgreSQL with RLS, with seamless local storage sync when testing prior to entering credentials.
- **Integrations**: Strava REST API v3 (Direct Token + OAuth 2.0).
- **PWA**: `vite-plugin-pwa`, Service Worker, Web App Manifest.

---

## 📋 Strava API Setup Instructions

To configure multi-member OAuth:
1. Go to your [Strava API Settings](https://www.strava.com/settings/api).
2. Create or edit your API Application:
   - **Application Name**: `Kolkata Runners Club`
   - **Category**: `Club`
   - **Club**: (Leave blank or select your club)
   - **Authorization Callback Domain**:
     ```
     ais-dev-2akgglgnqltyfuj2pkmlbu-325628829967.asia-east1.run.app
     ```
3. Set your Callback URLs in your Strava settings:
   - **Development URL**:
     `https://ais-dev-2akgglgnqltyfuj2pkmlbu-325628829967.asia-east1.run.app/auth/callback`
   - **Shared / Production URL**:
     `https://ais-pre-2akgglgnqltyfuj2pkmlbu-325628829967.asia-east1.run.app/auth/callback`
4. Copy your **Client ID** and **Client Secret** and add them to your `.env` file:
   ```env
   STRAVA_CLIENT_ID=your_client_id
   STRAVA_CLIENT_SECRET=your_client_secret
   ```

*Note: For immediate Milestone 2 testing without registering an OAuth app, you can use the **Direct Access Token** tab in the Strava modal to paste your personal Strava bearer token.*

---

## 🗄 Supabase Setup & Admin Bootstrap

1. Create a project on [Supabase](https://supabase.com).
2. Navigate to the **SQL Editor** and execute `/supabase/migrations/20261001_initial_schema.sql`.
3. Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to `.env`.
4. To bootstrap the first administrator:
   - Run in the Supabase SQL editor:
     ```sql
     UPDATE public.profiles
     SET role = 'ADMIN'
     WHERE id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');
     ```
   - Or click **"Sign In as Admin"** in the app's Sign In dialog.
