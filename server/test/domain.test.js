import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialRsvpStatus, promotionsNeeded, validateCapacityEdit } from '../src/domain/waitlist.js';

test('initialRsvpStatus: unlimited capacity always going', () => {
  assert.equal(initialRsvpStatus(500, null), 'going');
});
test('initialRsvpStatus: seat available', () => {
  assert.equal(initialRsvpStatus(2, 3), 'going');
});
test('initialRsvpStatus: full event waitlists', () => {
  assert.equal(initialRsvpStatus(3, 3), 'waitlisted');
});
test('promotionsNeeded: promotes in position order up to open seats', () => {
  const wl = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(promotionsNeeded(wl, 1, 3).promote, ['a', 'b']);
  assert.deepEqual(promotionsNeeded(wl, 3, 3).promote, []);
  assert.deepEqual(promotionsNeeded(wl, 0, null).promote, ['a', 'b', 'c']);
});
test('validateCapacityEdit: cannot shrink below going count', () => {
  assert.equal(validateCapacityEdit(5, 6).ok, false);
  assert.equal(validateCapacityEdit(6, 6).ok, true);
  assert.equal(validateCapacityEdit(null, 6).ok, true);
  assert.equal(validateCapacityEdit(0, 0).ok, false);
  assert.equal(validateCapacityEdit(2.5, 0).ok, false);
});

// Regression: seeded event times must land on the intended IST wall clock even
// when the host runs in UTC (Render). A naive setHours() shifted seeds +5:30.
test('seedStartInstant stores the UTC instant for the intended IST time', async () => {
  const { seedStartInstant } = await import('../src/seed.js');
  // 2026-10-26 05:30Z (= 11:00 IST); event 5 days out at 16:00 IST = 2026-10-31 10:30Z
  const s = seedStartInstant(5, 16, Date.UTC(2026, 9, 26, 5, 30));
  assert.equal(s.toISOString(), '2026-10-31T10:30:00.000Z');
  assert.equal(
    s.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: false }),
    '16:00',
  );
});
