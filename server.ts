import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import crypto from 'crypto';

dotenv.config();

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + '_krc_salt_2026').digest('hex');
}

// -------------------------------------------------------------
// AES-256-GCM SECURE TOKEN VAULT
// Encrypts Strava access tokens and refresh tokens at rest in Postgres
// -------------------------------------------------------------
const TOKEN_VAULT_SECRET =
  process.env.TOKEN_ENCRYPTION_KEY ||
  process.env.STRAVA_CLIENT_SECRET ||
  process.env.SESSION_SECRET ||
  '5am-runners-secure-token-vault-key-2026';

const tokenEncryptionKey = crypto.scryptSync(TOKEN_VAULT_SECRET, 'salt_5am_runners_strava_vault_2026', 32);

export function encryptToken(plainText: string | null | undefined): string | null {
  if (!plainText) return null;
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', tokenEncryptionKey, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `enc:${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err: any) {
    console.error('Token encryption failure:', err.message);
    return plainText;
  }
}

export function decryptToken(encryptedText: string | null | undefined): string | null {
  if (!encryptedText) return null;
  if (!encryptedText.startsWith('enc:')) {
    // Unencrypted legacy fallback
    return encryptedText;
  }
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 4) return encryptedText;
    const [, ivHex, authTagHex, encHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', tokenEncryptionKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err: any) {
    console.warn('Token decryption error, fallback to raw:', err.message);
    return encryptedText;
  }
}

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', true);
app.use(express.json());

// Initialize PostgreSQL Connection Pool to Supabase Database
const dbConnectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:Gopi%23Dev%4023!@db.zdfaekikopqtnixckrms.supabase.co:5432/postgres';

export const dbPool = new Pool({
  connectionString: dbConnectionString,
  ssl: { rejectUnauthorized: false },
});

dbPool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

// Test connection on boot
dbPool.connect((err, client, release) => {
  if (err) {
    console.warn('⚠️ PostgreSQL connection failed, operating with memory/fallback:', err.message);
  } else {
    console.log('✅ Connected directly to Supabase PostgreSQL database!');
    release();
  }
});

// In-memory data store for server-managed Strava connections and sync state
interface StravaTokenData {
  memberId: string;
  athleteId: number;
  athleteName: string;
  athleteAvatar?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  lastSyncedAt?: string;
  syncStatus?: 'idle' | 'syncing' | 'error' | 'success';
  syncError?: string;
}

const stravaConnections = new Map<string, StravaTokenData>();
const syncLocks = new Set<string>();

// October 1, 2026 at 00:00 Asia/Kolkata (IST = UTC + 5:30)
// 2026-10-01 00:00:00 IST = 2026-09-30 18:30:00 UTC = epoch 1790793000 seconds
const OCT_2026_IST_START_EPOCH_SEC = Math.floor(
  new Date('2026-09-30T18:30:00.000Z').getTime() / 1000
);

function isSupportedRunType(type: string): boolean {
  const t = (type || '').toLowerCase().replace(/[\s_-]/g, '');
  return t === 'run' || t === 'trailrun' || t === 'virtualrun' || t === 'treadmill' || t === 'treadmillrun';
}

// -------------------------------------------------------------
// LIVE DATABASE SYNC ENDPOINTS
// -------------------------------------------------------------

// Fetch authoritative data from Supabase DB on startup
app.get('/api/db/data', async (_req: Request, res: Response) => {
  try {
    const clubRes = await dbPool.query('SELECT * FROM public.clubs LIMIT 1;');
    const profilesRes = await dbPool.query('SELECT * FROM public.profiles ORDER BY role DESC, display_name ASC;');
    const activitiesRes = await dbPool.query('SELECT * FROM public.activities ORDER BY start_date_timestamp DESC;');
    const goalsRes = await dbPool.query('SELECT * FROM public.monthly_goals;');
    const stravaRes = await dbPool.query('SELECT user_id, athlete_id, athlete_name, athlete_avatar, last_synced_at FROM public.strava_connections;').catch(() => ({ rows: [] }));

    const stravaMap = new Map<string, any>();
    for (const sc of stravaRes.rows) {
      if (sc.user_id) stravaMap.set(String(sc.user_id), sc);
    }

    const club = clubRes.rows[0] ? {
      id: clubRes.rows[0].id,
      name: clubRes.rows[0].name,
      description: clubRes.rows[0].description,
      imageUrl: clubRes.rows[0].image_url,
      announcement: clubRes.rows[0].announcement,
      location: clubRes.rows[0].location,
      foundedYear: clubRes.rows[0].founded_year,
    } : null;

    const members = profilesRes.rows.map((p) => {
      const sc = stravaMap.get(String(p.id)) || stravaMap.get(String(p.email));
      return {
        id: p.id,
        email: p.email,
        displayName: p.display_name,
        avatarUrl: p.avatar_url,
        role: p.role,
        status: p.status,
        joinedAt: p.created_at,
        currentGoalGroup: p.current_goal_group || 'up_to_50',
        nextMonthGoalGroup: p.next_month_goal_group || 'up_to_50',
        hasStravaSync: Boolean(sc),
        stravaAthleteName: sc?.athlete_name,
        stravaLastSyncedAt: sc?.last_synced_at,
      };
    });

    const activities = activitiesRes.rows.map((a) => ({
      id: a.id,
      stravaActivityId: a.strava_activity_id,
      memberId: a.member_id,
      athleteId: a.athlete_id,
      title: a.title,
      sportType: a.sport_type,
      distanceMeters: Number(a.distance_meters),
      movingTimeSeconds: Number(a.moving_time_seconds),
      elapsedTimeSeconds: Number(a.elapsed_time_seconds),
      startDateLocal: a.start_date_local,
      startDateTimestamp: Number(a.start_date_timestamp),
      manual: Boolean(a.manual),
      visibility: a.visibility,
      isExcluded: Boolean(a.is_excluded),
      exclusionReason: a.exclusion_reason,
    }));

    const monthlyGoals = goalsRes.rows.map((g) => ({
      id: g.id,
      userId: g.user_id,
      monthKey: g.month_key,
      goalGroup: g.goal_group,
      updatedAt: g.updated_at,
    }));

    res.json({ success: true, club, members, activities, monthlyGoals });
  } catch (err: any) {
    console.error('Error querying Supabase DB:', err.message);
    res.json({ success: false, error: err.message });
  }
});

// Update member next month goal
app.post('/api/profile/next-month-goal', async (req: Request, res: Response) => {
  try {
    const { userId, goalGroup } = req.body;
    if (!userId || !goalGroup) {
      return res.status(400).json({ error: 'userId and goalGroup required.' });
    }
    await dbPool.query(
      'UPDATE public.profiles SET next_month_goal_group = $1 WHERE id = $2;',
      [goalGroup, userId]
    );
    await dbPool.query(
      `INSERT INTO public.monthly_goals (user_id, month_key, goal_group)
       VALUES ($1, '2026-11', $2)
       ON CONFLICT (user_id, month_key) DO UPDATE SET goal_group = EXCLUDED.goal_group;`,
      [userId, goalGroup]
    ).catch(() => {});
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// AUTHENTICATION ENDPOINTS (Backed by Supabase PostgreSQL)
// -------------------------------------------------------------

// 1. User Signup
app.post('/api/auth/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, displayName, goalGroup, avatarUrl } = req.body;
    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'Email, password, and display name are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = displayName.trim();

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const pwdHash = hashPassword(password);

    // Check if user already exists in profiles
    const existing = await dbPool.query('SELECT id, password_hash, role, status FROM public.profiles WHERE email = $1;', [cleanEmail]);
    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      // If user exists and already has a password, prompt them to sign in
      if (row.password_hash) {
        return res.status(400).json({ error: 'An account with this email already exists. Please sign in instead.' });
      } else {
        // Pre-seeded or previously created row without password: update password and activate
        await dbPool.query(
          `UPDATE public.profiles
           SET password_hash = $1, display_name = $2, current_goal_group = $3, avatar_url = COALESCE($4, avatar_url)
           WHERE email = $5;`,
          [pwdHash, cleanName, goalGroup || 'up_to_50', avatarUrl || null, cleanEmail]
        );
      }
    } else {
      // New member insert
      await dbPool.query(
        `INSERT INTO public.profiles (id, email, password_hash, display_name, role, status, avatar_url, current_goal_group, next_month_goal_group)
         VALUES (gen_random_uuid(), $1, $2, $3, 'MEMBER', 'active', $4, $5, $5);`,
        [cleanEmail, pwdHash, cleanName, avatarUrl || null, goalGroup || 'up_to_50']
      );
    }

    const profileRes = await dbPool.query('SELECT * FROM public.profiles WHERE email = $1;', [cleanEmail]);
    const memberRow = profileRes.rows[0];

    // Create initial monthly goal
    await dbPool.query(
      `INSERT INTO public.monthly_goals (user_id, month_key, goal_group)
       VALUES ($1, '2026-10', $2)
       ON CONFLICT (user_id, month_key) DO NOTHING;`,
      [memberRow.id, memberRow.current_goal_group || 'up_to_50']
    ).catch(() => {});

    res.json({
      success: true,
      member: {
        id: memberRow.id,
        email: memberRow.email,
        displayName: memberRow.display_name,
        role: memberRow.role,
        status: memberRow.status,
        avatarUrl: memberRow.avatar_url,
        currentGoalGroup: memberRow.current_goal_group,
        nextMonthGoalGroup: memberRow.next_month_goal_group,
        joinedAt: memberRow.created_at,
      },
    });
  } catch (err: any) {
    console.error('Database signup error:', err);
    res.status(500).json({ error: err.message || 'Database error during signup.' });
  }
});

// 2. User Login
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const result = await dbPool.query('SELECT * FROM public.profiles WHERE email = $1;', [cleanEmail]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No account found with this email. Please click Sign Up.' });
    }

    const row = result.rows[0];
    if (row.status === 'suspended') {
      return res.status(403).json({ error: 'Your membership is suspended. Please contact an admin.' });
    }

    const inputHash = hashPassword(password);

    if (row.password_hash) {
      if (row.password_hash !== inputHash) {
        return res.status(401).json({ error: 'Invalid password. Please check your credentials.' });
      }
    } else {
      // First-time sign in for pre-seeded user (e.g. admin or seed): set password to provided password
      await dbPool.query('UPDATE public.profiles SET password_hash = $1 WHERE id = $2;', [inputHash, row.id]);
    }

    res.json({
      success: true,
      member: {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        role: row.role,
        status: row.status,
        avatarUrl: row.avatar_url,
        currentGoalGroup: row.current_goal_group || 'up_to_50',
        nextMonthGoalGroup: row.next_month_goal_group || 'up_to_50',
        joinedAt: row.created_at,
      },
    });
  } catch (err: any) {
    console.error('Database login error:', err);
    res.status(500).json({ error: err.message || 'Database error during login.' });
  }
});

// 3. Password Reset
app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const result = await dbPool.query('SELECT id FROM public.profiles WHERE email = $1;', [cleanEmail]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No registered member found with this email address.' });
    }

    // In a production app, send email with reset token. Here, acknowledge reset:
    res.json({
      success: true,
      message: `Password reset instructions have been recorded for ${cleanEmail}. Please enter a new password to sign in.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error processing reset request.' });
  }
});

// -------------------------------------------------------------
// STRAVA OAUTH & API ENDPOINTS
// -------------------------------------------------------------

function getAppUrl(req: Request): string {
  let appUrl = '';
  if (req.query.origin && typeof req.query.origin === 'string') {
    appUrl = req.query.origin.trim().replace(/\/$/, '');
  } else if (req.headers.origin && typeof req.headers.origin === 'string') {
    appUrl = req.headers.origin.trim().replace(/\/$/, '');
  } else if (req.headers.referer && typeof req.headers.referer === 'string') {
    try {
      const u = new URL(req.headers.referer);
      appUrl = u.origin.replace(/\/$/, '');
    } catch {}
  }

  if (!appUrl) {
    if (req.headers['x-forwarded-host']) {
      const proto = req.headers['x-forwarded-proto'] || 'https';
      const fwdHost = String(req.headers['x-forwarded-host']).split(',')[0].trim();
      appUrl = `${proto}://${fwdHost}`.replace(/\/$/, '');
    } else {
      appUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    }
  }

  // Ensure published container maps directly to public production domain
  if (appUrl.includes('app-5amrunners') || appUrl.includes('5amrunners.ai.studio')) {
    appUrl = 'https://5amrunners.ai.studio';
  }

  return appUrl;
}

// 0. Get & Save Strava OAuth Configuration
app.get('/api/strava/config', (req: Request, res: Response) => {
  const clientId = process.env.STRAVA_CLIENT_ID || process.env.CLIENT_ID || '';
  const clientSecret = process.env.STRAVA_CLIENT_SECRET || process.env.CLIENT_SECRET || '';
  const appUrl = getAppUrl(req);
  const redirectUri = `${appUrl}/auth/callback`;
  const urlObj = new URL(redirectUri);

  res.json({
    configured: Boolean(clientId && clientSecret),
    clientId,
    redirectUri,
    callbackDomain: urlObj.hostname,
  });
});

app.post('/api/strava/config', (req: Request, res: Response) => {
  const { clientId, clientSecret } = req.body;
  if (!clientId || !clientSecret) {
    return res.status(400).json({ error: 'Both Client ID and Client Secret are required.' });
  }

  process.env.STRAVA_CLIENT_ID = String(clientId).trim();
  process.env.STRAVA_CLIENT_SECRET = String(clientSecret).trim();

  // Also update .env file
  try {
    const fs = require('fs');
    let envContent = '';
    if (fs.existsSync('.env')) {
      envContent = fs.readFileSync('.env', 'utf8');
    }
    // Update or append STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET
    if (envContent.includes('STRAVA_CLIENT_ID=')) {
      envContent = envContent.replace(/STRAVA_CLIENT_ID=.*/g, `STRAVA_CLIENT_ID="${process.env.STRAVA_CLIENT_ID}"`);
    } else {
      envContent += `\nSTRAVA_CLIENT_ID="${process.env.STRAVA_CLIENT_ID}"`;
    }
    if (envContent.includes('STRAVA_CLIENT_SECRET=')) {
      envContent = envContent.replace(/STRAVA_CLIENT_SECRET=.*/g, `STRAVA_CLIENT_SECRET="${process.env.STRAVA_CLIENT_SECRET}"`);
    } else {
      envContent += `\nSTRAVA_CLIENT_SECRET="${process.env.STRAVA_CLIENT_SECRET}"`;
    }
    fs.writeFileSync('.env', envContent.trim() + '\n');
  } catch (e) {
    console.warn('Could not persist to .env:', e);
  }

  res.json({ success: true, message: 'Strava OAuth credentials saved successfully!' });
});

// 1. Get OAuth authorization URL
app.get('/api/strava/auth-url', (req: Request, res: Response) => {
  const clientId = process.env.STRAVA_CLIENT_ID || process.env.CLIENT_ID;

  const appUrl = getAppUrl(req);
  const redirectUri = `${appUrl}/auth/callback`;
  const memberId = (req.query.memberId as string) || 'member_user';
  const state = Buffer.from(JSON.stringify({ memberId, timestamp: Date.now() })).toString('base64');

  if (!clientId) {
    return res.status(200).json({
      configured: false,
      message: 'Strava Client ID is not configured in .env yet.',
      redirectUri,
    });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'read,activity:read_all',
    state,
  });

  const authUrl = `https://www.strava.com/oauth/authorize?${params.toString()}`;
  res.json({ configured: true, url: authUrl, redirectUri });
});

// 2. OAuth Callback Popup Handler
const callbackHandler = (req: Request, res: Response) => {
  const { code, state, error } = req.query;

  res.setHeader('Content-Type', 'text/html');
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>Strava Authorization</title>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            background: #141414;
            color: #FAF9F6;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            text-align: center;
            padding: 24px;
          }
          .card {
            background: #202020;
            border: 1px solid #FF9F1C;
            border-radius: 12px;
            padding: 32px;
            max-width: 400px;
          }
          h2 { color: #FF9F1C; margin-top: 0; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>${error ? 'Connection Failed' : 'Strava Connected!'}</h2>
          <p>${error ? 'Authorization was denied or failed.' : 'Returning to 5Am runners club...'}</p>
        </div>
        <script>
          const data = {
            type: 'STRAVA_AUTH_RESULT',
            code: ${JSON.stringify(code || null)},
            state: ${JSON.stringify(state || null)},
            error: ${JSON.stringify(error || null)}
          };
          if (window.opener) {
            window.opener.postMessage(data, '*');
            setTimeout(() => {
              window.close();
            }, 600);
          } else {
            window.location.href = '/';
          }
        </script>
      </body>
    </html>
  `);
};

app.get(['/auth/callback', '/auth/callback/'], callbackHandler);

// 3. Exchange OAuth Code for Tokens
app.post('/api/strava/exchange', async (req: Request, res: Response) => {
  try {
    const { code, memberId } = req.body;
    const clientId = process.env.STRAVA_CLIENT_ID || process.env.CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET || process.env.CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(400).json({
        error: 'Strava Client ID or Secret missing on server. Check .env configuration.',
      });
    }

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required.' });
    }

    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errData = (await tokenResponse.json().catch(() => ({}))) as any;
      return res.status(400).json({
        error: `Strava token exchange failed: ${errData?.message || tokenResponse.statusText}`,
      });
    }

    const data = (await tokenResponse.json()) as any;
    const athlete = data.athlete || {};
    const athleteName = [athlete.firstname, athlete.lastname].filter(Boolean).join(' ') || 'Strava Athlete';

    // Resolve memberId to database profile UUID
    let dbUserId = memberId || 'member_user';
    try {
      const profRes = await dbPool.query(
        'SELECT id FROM public.profiles WHERE id::text = $1 OR email = $1 LIMIT 1;',
        [memberId]
      );
      if (profRes.rows.length > 0) {
        dbUserId = profRes.rows[0].id;
      }
    } catch {}

    const conn: StravaTokenData = {
      memberId: dbUserId,
      athleteId: athlete.id,
      athleteName,
      athleteAvatar: athlete.profile_medium || athlete.profile,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at,
      lastSyncedAt: new Date().toISOString(),
      syncStatus: 'idle',
    };
    stravaConnections.set(dbUserId, conn);
    if (memberId && memberId !== dbUserId) {
      stravaConnections.set(memberId, conn);
    }

    // Persist encrypted tokens to PostgreSQL Database
    try {
      await dbPool.query(
        `INSERT INTO public.strava_connections (
           user_id, athlete_id, athlete_name, athlete_avatar,
           access_token, refresh_token, expires_at, last_synced_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           athlete_id = EXCLUDED.athlete_id,
           athlete_name = EXCLUDED.athlete_name,
           athlete_avatar = EXCLUDED.athlete_avatar,
           access_token = EXCLUDED.access_token,
           refresh_token = COALESCE(EXCLUDED.refresh_token, strava_connections.refresh_token),
           expires_at = COALESCE(EXCLUDED.expires_at, strava_connections.expires_at),
           last_synced_at = NOW();`,
        [
          dbUserId,
          conn.athleteId,
          conn.athleteName,
          conn.athleteAvatar || null,
          encryptToken(conn.accessToken),
          encryptToken(conn.refreshToken),
          conn.expiresAt || null,
        ]
      );
    } catch (dbErr: any) {
      console.warn('DB strava_connections insert warning:', dbErr.message);
    }

    await performStravaSync(dbUserId);

    res.json({
      success: true,
      athleteId: conn.athleteId,
      athleteName: conn.athleteName,
      athleteAvatar: conn.athleteAvatar,
      connectedAt: conn.lastSyncedAt,
    });
  } catch (err: any) {
    console.error('Strava token exchange error:', err);
    res.status(500).json({ error: err.message || 'Server error during Strava exchange.' });
  }
});

// 4. Milestone 2: Direct Supplied Access Token Testing
app.post('/api/strava/test-token', async (req: Request, res: Response) => {
  try {
    const { accessToken, memberId } = req.body;

    if (!accessToken || typeof accessToken !== 'string' || !accessToken.trim()) {
      return res.status(400).json({ error: 'Strava access token is required.' });
    }

    const cleanToken = accessToken.trim();

    // Verify athlete identity
    const athleteRes = await fetch('https://www.strava.com/api/v3/athlete', {
      headers: { Authorization: `Bearer ${cleanToken}` },
    });

    if (!athleteRes.ok) {
      const errBody = (await athleteRes.json().catch(() => ({}))) as any;
      const msg = errBody?.message || athleteRes.statusText;
      if (athleteRes.status === 401) {
        return res.status(401).json({
          error: 'Invalid or expired Strava access token. Please verify token permissions.',
        });
      }
      return res.status(athleteRes.status).json({
        error: `Strava API error: ${msg}`,
      });
    }

    const athlete = (await athleteRes.json()) as any;
    const athleteName = [athlete.firstname, athlete.lastname].filter(Boolean).join(' ') || 'Strava Runner';
    const targetMemberId = memberId || 'member_user';

    const conn: StravaTokenData = {
      memberId: targetMemberId,
      athleteId: athlete.id,
      athleteName,
      athleteAvatar: athlete.profile_medium || athlete.profile,
      accessToken: cleanToken,
      lastSyncedAt: new Date().toISOString(),
      syncStatus: 'idle',
    };
    stravaConnections.set(targetMemberId, conn);

    // Persist encrypted token to PostgreSQL Database
    try {
      await dbPool.query(
        `INSERT INTO public.strava_connections (
           user_id, athlete_id, athlete_name, athlete_avatar,
           access_token, last_synced_at
         )
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           athlete_id = EXCLUDED.athlete_id,
           athlete_name = EXCLUDED.athlete_name,
           athlete_avatar = EXCLUDED.athlete_avatar,
           access_token = EXCLUDED.access_token,
           last_synced_at = NOW();`,
        [
          targetMemberId,
          conn.athleteId,
          conn.athleteName,
          conn.athleteAvatar || null,
          encryptToken(cleanToken),
        ]
      );
    } catch (e: any) {
      console.warn('DB test-token insert warning:', e.message);
    }

    const syncResult = await performStravaSync(targetMemberId);

    res.json({
      success: true,
      athlete: {
        id: athlete.id,
        name: athleteName,
        city: athlete.city,
        country: athlete.country,
        avatar: athlete.profile_medium || athlete.profile,
      },
      syncSummary: syncResult,
    });
  } catch (err: any) {
    console.error('Error testing Strava token:', err);
    res.status(500).json({ error: err.message || 'Internal server error validating token.' });
  }
});

// Helper: Refresh Strava OAuth token seamlessly and persist to database
async function refreshStravaToken(conn: StravaTokenData, dbMemberUuid?: string): Promise<string> {
  const clientId = process.env.STRAVA_CLIENT_ID || process.env.CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET || process.env.CLIENT_SECRET;

  if (!conn.refreshToken) {
    throw new Error('No refresh token available to renew Strava session.');
  }
  if (!clientId || !clientSecret) {
    throw new Error('Strava client credentials missing for token refresh.');
  }

  const refreshRes = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: conn.refreshToken,
    }),
  });

  if (!refreshRes.ok) {
    const errData = (await refreshRes.json().catch(() => ({}))) as any;
    throw new Error(errData?.message || 'Failed to refresh expired Strava session.');
  }

  const refData = (await refreshRes.json()) as any;
  conn.accessToken = refData.access_token;
  if (refData.refresh_token) {
    conn.refreshToken = refData.refresh_token;
  }
  conn.expiresAt = refData.expires_at;

  const targetId = dbMemberUuid || conn.memberId;
  await dbPool.query(
    `UPDATE public.strava_connections
     SET access_token = $1, refresh_token = COALESCE($2, refresh_token), expires_at = $3, last_synced_at = NOW()
     WHERE user_id::text = $4 OR user_id::text = $5;`,
    [encryptToken(conn.accessToken), encryptToken(conn.refreshToken), conn.expiresAt, conn.memberId, targetId]
  ).catch((e) => console.warn('DB token update warning:', e.message));

  return conn.accessToken;
}

// 5. Core Strava Sync Function (Paginated, deduplicated, rolling 90 days, runs only)
async function performStravaSync(memberId: string): Promise<{ imported: number; total: number; runs: any[] }> {
  if (syncLocks.has(memberId)) {
    throw new Error('A sync is already in progress for this runner. Please wait a moment.');
  }

  // Resolve memberId to database UUID if needed
  let dbMemberUuid = memberId;
  try {
    const memberLookup = await dbPool.query(
      `SELECT id FROM public.profiles WHERE id::text = $1 OR email = $1 LIMIT 1;`,
      [memberId]
    );
    if (memberLookup.rows.length > 0) {
      dbMemberUuid = memberLookup.rows[0].id;
    }
  } catch {}

  let conn = stravaConnections.get(memberId) || stravaConnections.get(dbMemberUuid);
  if (!conn || !conn.accessToken) {
    try {
      const dbConn = await dbPool.query(
        'SELECT * FROM public.strava_connections WHERE user_id::text = $1 OR user_id::text = $2 LIMIT 1;',
        [memberId, dbMemberUuid]
      );
      if (dbConn.rows.length > 0) {
        const row = dbConn.rows[0];
        conn = {
          memberId: dbMemberUuid,
          athleteId: Number(row.athlete_id),
          athleteName: row.athlete_name,
          athleteAvatar: row.athlete_avatar,
          accessToken: decryptToken(row.access_token) || '',
          refreshToken: decryptToken(row.refresh_token) || undefined,
          expiresAt: row.expires_at ? Number(row.expires_at) : undefined,
          lastSyncedAt: row.last_synced_at,
          syncStatus: 'idle',
        };
        stravaConnections.set(memberId, conn);
        stravaConnections.set(dbMemberUuid, conn);
      }
    } catch {}
  }

  if (!conn || !conn.accessToken) {
    throw new Error('No active Strava connection found for this member. Please connect your Strava account first.');
  }

  syncLocks.add(memberId);
  syncLocks.add(dbMemberUuid);
  conn.syncStatus = 'syncing';

  try {
    let accessToken = conn.accessToken;

    // 1. Proactive Refresh: Check if token expires within 10 minutes (600s) or has expired
    const nowSec = Math.floor(Date.now() / 1000);
    if (conn.refreshToken && conn.expiresAt && nowSec > conn.expiresAt - 600) {
      console.log(`[Strava Vault] Proactively refreshing expiring token for member ${conn.memberId}...`);
      try {
        accessToken = await refreshStravaToken(conn, dbMemberUuid);
      } catch (refErr: any) {
        console.warn('Proactive refresh warning:', refErr.message);
      }
    }

    // Retrieve activities from the past 90 days to populate rolling 30D and recent months
    const nowEpochSec = Math.floor(Date.now() / 1000);
    const afterBoundary = nowEpochSec - 90 * 86400;

    let page = 1;
    const perPage = 50;
    let keepPaging = true;
    let newImportedCount = 0;
    const fetchedActivities: any[] = [];

    while (keepPaging && page <= 5) {
      const stravaUrl = `https://www.strava.com/api/v3/athlete/activities?after=${afterBoundary}&page=${page}&per_page=${perPage}`;
      let resp = await fetch(stravaUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      // 2. Reactive Auto-Refresh on 401 Unauthorized
      if (resp.status === 401 && conn.refreshToken) {
        console.log(`[Strava Vault] Received 401 Unauthorized for ${conn.memberId}. Attempting instant token refresh...`);
        try {
          accessToken = await refreshStravaToken(conn, dbMemberUuid);
          // Retry the activity fetch with the newly refreshed access token
          resp = await fetch(stravaUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
        } catch (retryErr: any) {
          console.error('Refresh retry failed:', retryErr.message);
          throw new Error('Your Strava authorization has expired. Please re-authorize by clicking Connect Strava.');
        }
      }

      if (!resp.ok) {
        if (resp.status === 401) {
          throw new Error('Your Strava authorization has expired. Please click Connect Strava to reconnect.');
        }
        const errJson = (await resp.json().catch(() => ({}))) as any;
        throw new Error(errJson?.message || `Strava API returned status ${resp.status}`);
      }

      const list = (await resp.json()) as any[];
      if (!Array.isArray(list) || list.length === 0) {
        keepPaging = false;
        break;
      }

      fetchedActivities.push(...list);
      if (list.length < perPage) {
        keepPaging = false;
      } else {
        page++;
      }
    }

    // Persist to Supabase Database
    for (const act of fetchedActivities) {
      const sport = act.sport_type || act.type || '';
      if (!isSupportedRunType(sport)) {
        continue;
      }

      const visibility = act.visibility || (act.private ? 'only_me' : 'everyone');
      const stravaId = String(act.id);
      const title = act.name || 'Running Activity';
      const distance = Number(act.distance) || 0;
      const movingTime = Number(act.moving_time) || 0;
      const elapsedTime = Number(act.elapsed_time) || 0;
      const startDateLocal = act.start_date_local || act.start_date;
      const startTimestamp = new Date(act.start_date).getTime();
      const manual = Boolean(act.manual);

      try {
        await dbPool.query(
          `INSERT INTO public.activities (
            strava_activity_id, member_id, athlete_id, title, sport_type,
            distance_meters, moving_time_seconds, elapsed_time_seconds,
            start_date_local, start_date_timestamp, manual, visibility
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (member_id, strava_activity_id) DO UPDATE SET
            title = EXCLUDED.title,
            distance_meters = EXCLUDED.distance_meters,
            moving_time_seconds = EXCLUDED.moving_time_seconds,
            elapsed_time_seconds = EXCLUDED.elapsed_time_seconds;`,
          [
            stravaId,
            dbMemberUuid,
            conn.athleteId,
            title,
            sport,
            distance,
            movingTime,
            elapsedTime,
            startDateLocal,
            startTimestamp,
            manual,
            visibility,
          ]
        );
        newImportedCount++;
      } catch (dbErr: any) {
        console.warn('DB activity insert warning:', dbErr.message);
      }
    }

    conn.lastSyncedAt = new Date().toISOString();
    conn.syncStatus = 'success';
    delete conn.syncError;

    // Update public.strava_connections in DB with encrypted tokens
    await dbPool.query(
      `UPDATE public.strava_connections
       SET last_synced_at = NOW(), access_token = $1, refresh_token = COALESCE($2, refresh_token), expires_at = $3
       WHERE user_id::text = $4 OR user_id::text = $5;`,
      [encryptToken(accessToken), encryptToken(conn.refreshToken), conn.expiresAt || null, memberId, dbMemberUuid]
    ).catch(() => {});

    // Fetch user runs from database and format as camelCase for the frontend
    const dbRunsRes = await dbPool.query(
      `SELECT * FROM public.activities WHERE member_id::text = $1 OR member_id::text = $2 ORDER BY start_date_timestamp DESC;`,
      [memberId, dbMemberUuid]
    );

    const formattedRuns = dbRunsRes.rows.map((a: any) => ({
      id: a.id,
      stravaActivityId: a.strava_activity_id,
      memberId: a.member_id,
      athleteId: a.athlete_id,
      title: a.title,
      sportType: a.sport_type,
      distanceMeters: Number(a.distance_meters),
      movingTimeSeconds: Number(a.moving_time_seconds),
      elapsedTimeSeconds: Number(a.elapsed_time_seconds),
      startDateLocal: a.start_date_local,
      startDateTimestamp: Number(a.start_date_timestamp),
      manual: a.manual,
      visibility: a.visibility,
      isExcluded: a.is_excluded,
      exclusionReason: a.exclusion_reason,
    }));

    return {
      imported: newImportedCount,
      total: formattedRuns.length,
      runs: formattedRuns,
    };
  } catch (err: any) {
    conn.syncStatus = 'error';
    conn.syncError = err.message;
    throw err;
  } finally {
    syncLocks.delete(memberId);
    syncLocks.delete(dbMemberUuid);
  }
}

// 6. Manual Sync Endpoint
app.post('/api/strava/sync', async (req: Request, res: Response) => {
  try {
    const { memberId } = req.body;
    if (!memberId) {
      return res.status(400).json({ error: 'memberId is required for sync.' });
    }

    const result = await performStravaSync(memberId);
    res.json({
      success: true,
      lastSyncedAt: new Date().toISOString(),
      ...result,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Sync failed.' });
  }
});

// 7. Get Strava Status for member (from DB or memory)
app.get('/api/strava/status/:memberId', async (req: Request, res: Response) => {
  const memberId = req.params.memberId;
  let conn = stravaConnections.get(memberId);

  if (!conn) {
    try {
      let targetUserId = memberId;
      const profileLookup = await dbPool.query(
        'SELECT id FROM public.profiles WHERE id::text = $1 OR email = $1 LIMIT 1;',
        [memberId]
      );
      if (profileLookup.rows.length > 0) {
        targetUserId = profileLookup.rows[0].id;
      }

      const dbRes = await dbPool.query(
        'SELECT * FROM public.strava_connections WHERE user_id::text = $1 OR user_id::text = $2 LIMIT 1;',
        [memberId, targetUserId]
      );
      if (dbRes.rows.length > 0) {
        const row = dbRes.rows[0];
        conn = {
          memberId: targetUserId,
          athleteId: Number(row.athlete_id),
          athleteName: row.athlete_name,
          athleteAvatar: row.athlete_avatar,
          accessToken: decryptToken(row.access_token) || '',
          refreshToken: decryptToken(row.refresh_token) || undefined,
          expiresAt: row.expires_at ? Number(row.expires_at) : undefined,
          lastSyncedAt: row.last_synced_at,
          syncStatus: 'idle',
        };
        stravaConnections.set(memberId, conn);
        stravaConnections.set(targetUserId, conn);
      }
    } catch {}
  }

  if (conn) {
    res.json({
      connected: true,
      memberId: conn.memberId,
      athleteId: conn.athleteId,
      athleteName: conn.athleteName,
      athleteAvatar: conn.athleteAvatar,
      lastSyncedAt: conn.lastSyncedAt,
      syncStatus: conn.syncStatus || 'idle',
      syncError: conn.syncError,
    });
  } else {
    res.json({ connected: false });
  }
});

// 8. Disconnect Strava
app.post('/api/strava/disconnect', async (req: Request, res: Response) => {
  const { memberId } = req.body;
  if (memberId) {
    let targetUserId = memberId;
    try {
      const profileLookup = await dbPool.query(
        'SELECT id FROM public.profiles WHERE id::text = $1 OR email = $1 LIMIT 1;',
        [memberId]
      );
      if (profileLookup.rows.length > 0) {
        targetUserId = profileLookup.rows[0].id;
      }
    } catch {}

    stravaConnections.delete(memberId);
    stravaConnections.delete(targetUserId);

    await dbPool.query(
      'DELETE FROM public.strava_connections WHERE user_id::text = $1 OR user_id::text = $2;',
      [memberId, targetUserId]
    ).catch(() => {});
  }
  res.json({ success: true, message: 'Strava disconnected successfully.' });
});

// 8b. Admin: Remove Strava Sync for specific member
app.post('/api/admin/remove-strava-sync', async (req: Request, res: Response) => {
  try {
    const { memberId, adminRole } = req.body;
    if (adminRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    if (!memberId) {
      return res.status(400).json({ error: 'Member ID is required.' });
    }

    let targetUserId = memberId;
    try {
      const profileLookup = await dbPool.query(
        'SELECT id FROM public.profiles WHERE id::text = $1 OR email = $1 LIMIT 1;',
        [memberId]
      );
      if (profileLookup.rows.length > 0) {
        targetUserId = profileLookup.rows[0].id;
      }
    } catch {}

    stravaConnections.delete(memberId);
    stravaConnections.delete(targetUserId);

    await dbPool.query(
      'DELETE FROM public.strava_connections WHERE user_id::text = $1 OR user_id::text = $2;',
      [memberId, targetUserId]
    );

    res.json({ success: true, message: 'Strava sync connection removed successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Admin: Exclude / Reinstate Activity (Persisted directly to Supabase DB)
app.post('/api/admin/exclude-activity', async (req: Request, res: Response) => {
  try {
    const { activityId, reason, adminRole } = req.body;
    if (adminRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Exclusion reason is required.' });
    }

    await dbPool.query(
      `UPDATE public.activities SET is_excluded = true, exclusion_reason = $1 WHERE id::text = $2;`,
      [reason.trim(), activityId]
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/reinstate-activity', async (req: Request, res: Response) => {
  try {
    const { activityId, adminRole } = req.body;
    if (adminRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }

    await dbPool.query(
      `UPDATE public.activities SET is_excluded = false, exclusion_reason = NULL WHERE id::text = $1;`,
      [activityId]
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Admin: Member Status Update (Persisted to Supabase DB)
app.post('/api/admin/member-status', async (req: Request, res: Response) => {
  try {
    const { memberId, status, adminRole } = req.body;
    if (adminRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }

    await dbPool.query(
      `UPDATE public.profiles SET status = $1 WHERE id::text = $2;`,
      [status, memberId]
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Admin: Club Settings Update (Persisted to Supabase DB)
app.post('/api/admin/club-settings', async (req: Request, res: Response) => {
  try {
    const { name, description, imageUrl, announcement, adminRole } = req.body;
    if (adminRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin permission required.' });
    }

    await dbPool.query(
      `UPDATE public.clubs SET name = $1, description = $2, image_url = $3, announcement = $4;`,
      [name, description, imageUrl, announcement]
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// VITE DEV SERVER / STATIC ASSETS
// -------------------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: 3000,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏃 5Am runners club server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
