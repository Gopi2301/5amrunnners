// Date, Timezone (Asia/Kolkata), Distance, and Pace Utilities

export const TIMEZONE = 'Asia/Kolkata';

// Active launch month key
export const LAUNCH_MONTH_KEY = '2026-10';

/**
 * Robustly parses an activity's timestamp or date string into a valid Date object.
 * Correctly accounts for epoch seconds vs milliseconds, and ISO strings.
 */
export function parseActivityDate(
  input: { startDateTimestamp?: number | string; startDateLocal?: string } | string | number | Date | null | undefined
): Date {
  if (!input) return new Date();
  if (input instanceof Date) return isNaN(input.getTime()) ? new Date() : input;

  // If object with activity properties
  if (typeof input === 'object') {
    if ('startDateTimestamp' in input && input.startDateTimestamp) {
      const ts = Number(input.startDateTimestamp);
      if (!isNaN(ts) && ts > 0) {
        return new Date(ts < 10000000000 ? ts * 1000 : ts);
      }
    }
    if ('startDateLocal' in input && input.startDateLocal) {
      const d = new Date(input.startDateLocal);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  }

  // If numeric (epoch timestamp)
  if (typeof input === 'number') {
    if (isNaN(input) || input <= 0) return new Date();
    return new Date(input < 10000000000 ? input * 1000 : input);
  }

  // If string
  if (typeof input === 'string') {
    const trimmed = input.trim();
    const num = Number(trimmed);
    if (!isNaN(num) && num > 0) {
      return new Date(num < 10000000000 ? num * 1000 : num);
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }

  return new Date();
}

/**
 * Format meters into kilometers (e.g. 5230m -> "5.23 km" or "5.2 km")
 */
export function formatKm(meters: number, decimals: number = 1): string {
  const km = (meters || 0) / 1000;
  return `${km.toFixed(decimals)} km`;
}

export function toKmNumber(meters: number): number {
  return Math.round(((meters || 0) / 1000) * 100) / 100;
}

/**
 * Calculate pace in min/km from moving time (seconds) and distance (meters)
 * Pace = moving time in seconds / distance in kilometres
 */
export function calculatePaceSecondsPerKm(movingTimeSeconds: number, distanceMeters: number): number {
  if (!distanceMeters || distanceMeters <= 0 || !movingTimeSeconds || movingTimeSeconds <= 0) {
    return 0;
  }
  const km = distanceMeters / 1000;
  const pace = movingTimeSeconds / km;
  return isFinite(pace) ? pace : 0;
}

/**
 * Format pace in seconds per km to "M:SS /km"
 */
export function formatPace(paceSecPerKm: number): string {
  if (!paceSecPerKm || paceSecPerKm <= 0 || !isFinite(paceSecPerKm)) {
    return '--:-- /km';
  }
  const minutes = Math.floor(paceSecPerKm / 60);
  const seconds = Math.floor(paceSecPerKm % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds} /km`;
}

/**
 * Format seconds to "H:MM:SS" or "MM:SS" or "Hh Mm"
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return '0m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
}

/**
 * Format date in Asia/Kolkata timezone (e.g. "Oct 2, 2026")
 */
export function formatDateInIST(dateInput: any): string {
  try {
    const d = parseActivityDate(dateInput);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: TIMEZONE,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  } catch {
    return 'Recent';
  }
}

/**
 * Format date and time in Asia/Kolkata timezone (e.g. "Oct 2, 2026, 06:15 AM")
 */
export function formatDateTimeInIST(dateInput: any): string {
  try {
    const d = parseActivityDate(dateInput);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: TIMEZONE,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return 'Recent';
  }
}

/**
 * Format time in Asia/Kolkata timezone (e.g. "06:15 AM")
 */
export function formatTimeInIST(dateInput: any): string {
  try {
    const d = parseActivityDate(dateInput);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return '';
  }
}

/**
 * Extract "YYYY-MM" month key in Asia/Kolkata timezone
 */
export function getMonthKeyInIST(dateInput: any): string {
  try {
    const d = parseActivityDate(dateInput);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
    }).format(d);
    return parts; // format "YYYY-MM" in en-CA
  } catch {
    return LAUNCH_MONTH_KEY;
  }
}

/**
 * Get human readable month title (e.g. "2026-10" -> "October 2026")
 */
export function formatMonthName(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return monthKey;
  const d = new Date(Date.UTC(year, month - 1, 15));
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(d);
}

/**
 * Check if an activity took place within a precise month in Asia/Kolkata
 */
export function isActivityInMonth(act: any, monthKey: string): boolean {
  if (!act) return false;
  const key = getMonthKeyInIST(act);
  return key === monthKey;
}

/**
 * Check if an activity took place within the last N days (rolling window, default 30 days)
 */
export function isActivityInLastDays(act: any, days: number = 30): boolean {
  if (!act) return false;
  const actDate = parseActivityDate(act);
  const actTime = actDate.getTime();
  if (isNaN(actTime) || actTime <= 0) return false;

  const now = Date.now();
  const windowStart = now - days * 24 * 60 * 60 * 1000;
  // Allow slightly future tolerance (up to 1 hour ahead for clock skew)
  return actTime >= windowStart && actTime <= now + 3600000;
}

/**
 * Check if a run qualifies for 5K pace leaderboard:
 * Distance between 4.95 km and 6.20 km (4950m to 6200m)
 * Excludes manual, non-runs, and admin-excluded activities.
 */
export function isEligible5K(distanceMeters: number, manual: boolean, isExcluded: boolean): boolean {
  if (manual || isExcluded) return false;
  return distanceMeters >= 4950 && distanceMeters <= 6200;
}

/**
 * Check if a run qualifies for 10K pace leaderboard:
 * Distance between 9.90 km and 12.00 km (9900m to 12000m)
 * Excludes manual, non-runs, and admin-excluded activities.
 */
export function isEligible10K(distanceMeters: number, manual: boolean, isExcluded: boolean): boolean {
  if (manual || isExcluded) return false;
  return distanceMeters >= 9900 && distanceMeters <= 12000;
}
