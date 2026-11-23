import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALARM_TONES,
  DEFAULT_FILTER_APPS,
  MOTIVATIONAL_QUOTES,
  buildDefaultAllowMap,
  computeDriftCorrectedRemaining,
  computeNextTriggerTimestamp,
  computeScheduleDurationSeconds,
  filterAppsByQuery,
  formatDurationHms,
  isAppAllowed,
  shouldTriggerAlarm,
  toggleAppAllowed,
  type ScheduleAlarm,
} from './scheduleEngine';

test('quotes and built-in alarm tones meet minimum requirements', () => {
  assert.ok(MOTIVATIONAL_QUOTES.length >= 20, 'must provide at least 20 motivational quotes');
  assert.equal(ALARM_TONES.length, 6, 'must provide 6 built-in WebAudio alarm tones');
});

test('default notification filter allows ONLY WhatsApp Calls and Normal Phone Calls', () => {
  const allowMap = buildDefaultAllowMap();
  const allowedIds = Object.keys(allowMap).filter((id) => allowMap[id]);
  assert.deepEqual(allowedIds.sort(), ['normal_calls', 'whatsapp_calls']);
  assert.equal(isAppAllowed('whatsapp_calls', allowMap), true);
  assert.equal(isAppAllowed('normal_calls', allowMap), true);
  assert.equal(isAppAllowed('whatsapp_messages', allowMap), false);
  assert.equal(isAppAllowed('instagram', allowMap), false);
  assert.equal(isAppAllowed('youtube', allowMap), false);
});

test('toggleAppAllowed and filterAppsByQuery work accurately', () => {
  const initial = buildDefaultAllowMap();
  const toggled = toggleAppAllowed(initial, 'instagram');
  assert.equal(isAppAllowed('instagram', toggled), true);
  assert.equal(isAppAllowed('instagram', initial), false);

  const matches = filterAppsByQuery(DEFAULT_FILTER_APPS, 'whatsapp');
  assert.equal(matches.length, 2);
});

test('computeScheduleDurationSeconds handles same-day and overnight windows', () => {
  assert.equal(computeScheduleDurationSeconds('09:00:00', '10:30:00'), 5400);
  assert.equal(computeScheduleDurationSeconds('23:30:00', '00:30:00'), 3600);
  assert.equal(computeScheduleDurationSeconds('14:00:00', '14:01:00'), 60);
});

test('computeNextTriggerTimestamp schedules today if future and tomorrow if passed', () => {
  const base = new Date(2026, 10, 23, 10, 0, 0, 0).getTime();
  const future = computeNextTriggerTimestamp('10:05:00', base);
  assert.equal(future - base, 5 * 60 * 1000);

  const passed = computeNextTriggerTimestamp('09:55:00', base);
  const expectedTomorrow = new Date(2026, 10, 24, 9, 55, 0, 0).getTime();
  assert.equal(passed, expectedTomorrow);
});

test('shouldTriggerAlarm fires once inside trigger window and prevents duplicates', () => {
  const triggerAt = 1_700_000_000_000;
  const alarm: ScheduleAlarm = {
    id: 'a1',
    label: 'Morning Math',
    startTime: '06:00:00',
    endTime: '07:00:00',
    enabled: true,
    tone: 'sunrise_bell',
    volume: 0.8,
    strictModeOnStart: true,
    notificationFilterOnStart: true,
    nextTriggerAt: triggerAt,
    createdAt: new Date(triggerAt - 60_000).toISOString(),
  };

  assert.equal(shouldTriggerAlarm(alarm, triggerAt - 1000), false);
  assert.equal(shouldTriggerAlarm(alarm, triggerAt + 500), true);
  assert.equal(shouldTriggerAlarm({ ...alarm, lastTriggeredAt: triggerAt + 500 }, triggerAt + 2000), false);
  assert.equal(shouldTriggerAlarm({ ...alarm, enabled: false }, triggerAt + 500), false);
});

test('drift-corrected remaining seconds and HH:MM:SS formatting stay accurate', () => {
  const now = 1_700_000_000_000;
  assert.equal(computeDriftCorrectedRemaining(now + 3661_000, now), 3661);
  assert.equal(computeDriftCorrectedRemaining(now - 5000, now), 0);
  assert.equal(formatDurationHms(3661), '01:01:01');
  assert.equal(formatDurationHms(0), '00:00:00');
});
