// RSVP capacity + waitlist core: pure functions, unit-tested, no I/O.

/**
 * Decide the status of a new RSVP.
 * goingCount: current number of 'going' attendees. capacity: null means unlimited.
 */
export function initialRsvpStatus(goingCount, capacity) {
  if (capacity === null || capacity === undefined) return 'going';
  return goingCount < capacity ? 'going' : 'waitlisted';
}

/**
 * Given current attendees after a cancellation or capacity increase, work out
 * which waitlisted RSVPs get promoted, in position order.
 * Returns { promote: [rsvpIds...], reason } - the caller applies it in one transaction.
 */
export function promotionsNeeded(waitlisted, goingCount, capacity) {
  if (capacity === null || capacity === undefined) {
    return { promote: waitlisted.map((r) => r.id), reason: 'unlimited-capacity' };
  }
  const openSeats = Math.max(0, capacity - goingCount);
  return { promote: waitlisted.slice(0, openSeats).map((r) => r.id), reason: 'seats-opened' };
}

/** Validate a capacity edit. Rejects shrinking below the current going count. */
export function validateCapacityEdit(newCapacity, goingCount) {
  if (newCapacity === null || newCapacity === undefined) return { ok: true };
  if (!Number.isInteger(newCapacity) || newCapacity < 1) {
    return { ok: false, error: 'Capacity must be a positive whole number (or empty for unlimited)' };
  }
  if (newCapacity < goingCount) {
    return { ok: false, error: `Capacity cannot be below the ${goingCount} people already going` };
  }
  return { ok: true };
}
