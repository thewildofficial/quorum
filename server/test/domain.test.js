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
