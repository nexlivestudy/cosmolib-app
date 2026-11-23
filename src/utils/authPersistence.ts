import type { StudyGroup, UserProfile } from '../types';

export const PROFILE_CACHE_PREFIX = 'cosmolib_profile_';
export const SIGN_OUT_SYNC_KEY = 'cosmolib_signout_sync';
export const TOKEN_REFRESH_LEAD_SECONDS = 300; // Refresh proactively 5 minutes before expiry

export interface CachedProfileRecord {
  profile: UserProfile;
  customGroups: StudyGroup[];
  cachedAt: number;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Checks whether a localStorage key is Supabase's persisted auth token key (`sb-<ref>-auth-token`).
 */
export function isSupabaseAuthTokenKey(key: string | null | undefined): boolean {
  if (!key) return false;
  return /^sb-[a-z0-9-]+-auth-token$/i.test(key);
}

/**
 * Returns true if a session's `expires_at` (epoch seconds) is already expired
 * or within `leadSeconds` (default 5 min) of expiring.
 */
export function isTokenExpiringSoon(
  expiresAtSeconds: number | null | undefined,
  nowMs: number = Date.now(),
  leadSeconds: number = TOKEN_REFRESH_LEAD_SECONDS
): boolean {
  if (typeof expiresAtSeconds !== 'number' || !Number.isFinite(expiresAtSeconds)) {
    return false;
  }
  const nowSeconds = Math.floor(nowMs / 1000);
  return expiresAtSeconds - nowSeconds <= leadSeconds;
}

/**
 * Computes milliseconds until the next proactive refresh should run.
 * Returns null if `expires_at` is missing; minimum delay is 1000ms for active timers.
 */
export function computeProactiveRefreshDelayMs(
  expiresAtSeconds: number | null | undefined,
  nowMs: number = Date.now(),
  leadSeconds: number = TOKEN_REFRESH_LEAD_SECONDS
): number | null {
  if (typeof expiresAtSeconds !== 'number' || !Number.isFinite(expiresAtSeconds)) {
    return null;
  }
  const targetMs = (expiresAtSeconds - leadSeconds) * 1000;
  return Math.max(1000, targetMs - nowMs);
}

/**
 * Reads and validates `cosmolib_profile_<userId>` from storage for instant reload restoration.
 */
export function readCachedProfile(
  userId: string,
  storage: StorageLike | null = typeof window !== 'undefined' ? window.localStorage : null
): CachedProfileRecord | null {
  if (!userId || !storage) return null;
  try {
    const raw = storage.getItem(`${PROFILE_CACHE_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as
      | { profile?: UserProfile; customGroups?: StudyGroup[]; cachedAt?: number }
      | UserProfile;

    const candidateProfile =
      parsed && typeof parsed === 'object' && 'profile' in parsed
        ? parsed.profile
        : (parsed as UserProfile);

    if (
      !candidateProfile ||
      typeof candidateProfile !== 'object' ||
      candidateProfile.id !== userId ||
      !candidateProfile.onboardingComplete
    ) {
      return null;
    }

    const customGroups =
      parsed && typeof parsed === 'object' && 'customGroups' in parsed && Array.isArray(parsed.customGroups)
        ? parsed.customGroups
        : [];

    const cachedAt =
      parsed && typeof parsed === 'object' && 'cachedAt' in parsed && typeof parsed.cachedAt === 'number'
        ? parsed.cachedAt
        : Date.now();

    return {
      profile: candidateProfile,
      customGroups,
      cachedAt,
    };
  } catch {
    return null;
  }
}

/**
 * Persists a user's profile under `cosmolib_profile_<userId>`.
 */
export function writeCachedProfile(
  profile: UserProfile,
  customGroups: StudyGroup[] = [],
  storage: StorageLike | null = typeof window !== 'undefined' ? window.localStorage : null
): void {
  if (!profile?.id || !storage) return;
  try {
    const payload: CachedProfileRecord = {
      profile,
      customGroups,
      cachedAt: Date.now(),
    };
    storage.setItem(`${PROFILE_CACHE_PREFIX}${profile.id}`, JSON.stringify(payload));
  } catch {
    // Ignore storage quota / private-mode errors
  }
}

/**
 * Clears cached profile for a user (strictly invoked on manual Sign Out).
 */
export function clearCachedProfile(
  userId: string | null | undefined,
  storage: StorageLike | null = typeof window !== 'undefined' ? window.localStorage : null
): void {
  if (!userId || !storage) return;
  try {
    storage.removeItem(`${PROFILE_CACHE_PREFIX}${userId}`);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Classifies a cross-tab `window.addEventListener('storage', ...)` event.
 */
export type CrossTabAuthAction =
  | { type: 'signed_out' }
  | { type: 'session_updated' }
  | { type: 'profile_updated'; userId: string }
  | { type: 'ignore' };

export function classifyStorageSyncEvent(
  key: string | null,
  newValue: string | null,
  activeUserId: string | null
): CrossTabAuthAction {
  if (!key) return { type: 'ignore' };

  if (key === SIGN_OUT_SYNC_KEY && newValue) {
    return { type: 'signed_out' };
  }

  if (isSupabaseAuthTokenKey(key)) {
    if (!newValue) {
      return { type: 'signed_out' };
    }
    return { type: 'session_updated' };
  }

  if (activeUserId && key === `${PROFILE_CACHE_PREFIX}${activeUserId}` && newValue) {
    return { type: 'profile_updated', userId: activeUserId };
  }

  return { type: 'ignore' };
}

/**
 * Wraps `fetch` for Supabase client calls so that any non-auth 401 response
 * refreshes the access token and retries the request once.
 */
export function createRetryOn401Fetch(
  baseFetch: typeof fetch,
  refreshAccessToken: () => Promise<string | null>
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await baseFetch(input, init);
    if (response.status !== 401) {
      return response;
    }

    const urlStr =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    // Never recurse on auth token/otp/logout endpoints themselves
    if (/\/auth\/v1\/(token|otp|verify|logout|signup)/i.test(urlStr)) {
      return response;
    }

    // Attempt a single refresh & retry
    const freshToken = await refreshAccessToken().catch(() => null);
    if (!freshToken) {
      return response;
    }

    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined)
    );
    headers.set('Authorization', `Bearer ${freshToken}`);

    return baseFetch(input, {
      ...init,
      headers,
    });
  };
}
