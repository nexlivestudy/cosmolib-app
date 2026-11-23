import test from 'node:test';
import assert from 'node:assert/strict';
import type { UserProfile } from '../types';
import {
  PROFILE_CACHE_PREFIX,
  SIGN_OUT_SYNC_KEY,
  classifyStorageSyncEvent,
  clearCachedProfile,
  computeProactiveRefreshDelayMs,
  createRetryOn401Fetch,
  isSupabaseAuthTokenKey,
  isTokenExpiringSoon,
  readCachedProfile,
  writeCachedProfile,
  type StorageLike,
} from './authPersistence';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

const sampleProfile: UserProfile = {
  id: 'user-123',
  email: 'student@uni.edu',
  displayName: 'Aarav',
  country: 'India',
  countryCode: 'IN',
  dailyTargetHours: 4,
  vibe: 'night_cook',
  streamCategory: 'Higher Education / Engineering',
  degreeLevel: 'B.Tech / B.E.',
  branch: 'Computer Science & Engineering',
  institution: 'IIT Bombay',
  primaryGroupId: 'grp-1',
  joinedGroupIds: ['grp-1'],
  streakDays: 5,
  minutesStudiedToday: 60,
  onboardingComplete: true,
};

test('isSupabaseAuthTokenKey matches only sb-<ref>-auth-token keys', () => {
  assert.equal(isSupabaseAuthTokenKey('sb-abcdefghij-auth-token'), true);
  assert.equal(isSupabaseAuthTokenKey('sb-my-proj-1-auth-token'), true);
  assert.equal(isSupabaseAuthTokenKey('cosmolib_profile_123'), false);
  assert.equal(isSupabaseAuthTokenKey(null), false);
});

test('isTokenExpiringSoon and computeProactiveRefreshDelayMs detect near-expiry and expired tokens', () => {
  const nowMs = 1_700_000_000_000; // 1700000000 seconds
  const nowSec = Math.floor(nowMs / 1000);

  // Expired yesterday (next-day reopen simulation)
  assert.equal(isTokenExpiringSoon(nowSec - 86400, nowMs), true);
  assert.equal(computeProactiveRefreshDelayMs(nowSec - 86400, nowMs), 1000);

  // Expires in 2 minutes (within 5-min lead)
  assert.equal(isTokenExpiringSoon(nowSec + 120, nowMs), true);
  assert.equal(computeProactiveRefreshDelayMs(nowSec + 120, nowMs), 1000);

  // Fresh token expiring in 1 hour
  assert.equal(isTokenExpiringSoon(nowSec + 3600, nowMs), false);
  assert.equal(computeProactiveRefreshDelayMs(nowSec + 3600, nowMs), (3600 - 300) * 1000);
});

test('profile cache writes, restores instantly, validates userId, and clears on sign out', () => {
  const storage = createMemoryStorage();
  writeCachedProfile(sampleProfile, [], storage);

  const restored = readCachedProfile('user-123', storage);
  assert.ok(restored);
  assert.equal(restored.profile.displayName, 'Aarav');
  assert.equal(restored.profile.onboardingComplete, true);

  // Reject mismatched userId
  assert.equal(readCachedProfile('other-user', storage), null);

  // Manual sign-out clears cached profile
  clearCachedProfile('user-123', storage);
  assert.equal(readCachedProfile('user-123', storage), null);
});

test('classifyStorageSyncEvent coordinates multi-tab sign-out, sign-in, and profile updates', () => {
  assert.deepEqual(
    classifyStorageSyncEvent('sb-proj123-auth-token', null, 'user-123'),
    { type: 'signed_out' }
  );
  assert.deepEqual(
    classifyStorageSyncEvent(SIGN_OUT_SYNC_KEY, '1700000000', 'user-123'),
    { type: 'signed_out' }
  );
  assert.deepEqual(
    classifyStorageSyncEvent('sb-proj123-auth-token', '{"access_token":"x"}', null),
    { type: 'session_updated' }
  );
  assert.deepEqual(
    classifyStorageSyncEvent(`${PROFILE_CACHE_PREFIX}user-123`, '{"profile":{}}', 'user-123'),
    { type: 'profile_updated', userId: 'user-123' }
  );
  assert.deepEqual(
    classifyStorageSyncEvent('unrelated-key', '123', 'user-123'),
    { type: 'ignore' }
  );
});

test('createRetryOn401Fetch refreshes once on 401 and retries with new Bearer token', async () => {
  let calls = 0;
  let refreshCalls = 0;
  const authHeaders: (string | null)[] = [];

  const mockFetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls += 1;
    const headers = new Headers(init?.headers);
    authHeaders.push(headers.get('Authorization'));
    if (calls === 1) {
      return new Response('Unauthorized', { status: 401 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  const wrappedFetch = createRetryOn401Fetch(mockFetch, async () => {
    refreshCalls += 1;
    return 'fresh-jwt-token';
  });

  const res = await wrappedFetch('https://demo.supabase.co/rest/v1/profiles', {
    headers: { Authorization: 'Bearer stale-jwt-token' },
  });

  assert.equal(res.status, 200);
  assert.equal(calls, 2);
  assert.equal(refreshCalls, 1);
  assert.deepEqual(authHeaders, ['Bearer stale-jwt-token', 'Bearer fresh-jwt-token']);
});

test('createRetryOn401Fetch never recurses on auth token endpoint', async () => {
  let calls = 0;
  let refreshCalls = 0;

  const mockFetch = (async () => {
    calls += 1;
    return new Response('Unauthorized', { status: 401 });
  }) as typeof fetch;

  const wrappedFetch = createRetryOn401Fetch(mockFetch, async () => {
    refreshCalls += 1;
    return 'should-not-run';
  });

  const res = await wrappedFetch('https://demo.supabase.co/auth/v1/token?grant_type=refresh_token');
  assert.equal(res.status, 401);
  assert.equal(calls, 1);
  assert.equal(refreshCalls, 0);
});
