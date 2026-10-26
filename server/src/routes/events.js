import { Router } from 'express';
import { badRequest } from '../errors.js';
import { requireAuth, requireOrganizer } from '../middleware/auth.js';
import { requireFields, isNonEmptyString } from '../middleware/validate.js';
import * as svc from '../services/eventService.js';

const router = Router();

// Public discovery (Luma-style: event pages are viewable without an account)
router.get('/', (req, res, next) => {
  try {
    const { when, q } = req.query;
    if (when && !['upcoming', 'past', 'all'].includes(when)) throw badRequest('Invalid time filter');
    res.json({ events: svc.listEvents({ when: when || 'upcoming', q: q ? String(q).slice(0, 200) : null, userId: req.user?.id }) });
  } catch (e) { next(e); }
});

router.get('/mine/rsvps', requireAuth, (req, res, next) => {
  try { res.json({ events: svc.myRsvps(req.user.id) }); } catch (e) { next(e); }
});

router.get('/:id', (req, res, next) => {
  try { res.json({ event: svc.eventWithCounts(svc.getEvent(req.params.id), req.user?.id) }); } catch (e) { next(e); }
});

router.post('/', requireOrganizer, (req, res, next) => {
  try {
    requireFields(req.body, ['title', 'startsAt', 'endsAt']);
    if (!isNonEmptyString(req.body.title, 140)) throw badRequest('Title is required (max 140 chars)');
    const capacity = req.body.capacity === null || req.body.capacity === undefined || req.body.capacity === ''
      ? null : Number(req.body.capacity);
    const event = svc.publishEvent(req.user.id, {
      title: req.body.title,
      description: String(req.body.description || '').slice(0, 5000),
      location: String(req.body.location || '').slice(0, 300),
      startsAt: req.body.startsAt,
      endsAt: req.body.endsAt,
      capacity,
    });
    res.status(201).json({ event: svc.eventWithCounts(event, req.user.id) });
  } catch (e) { next(e); }
});

router.patch('/:id', requireAuth, (req, res, next) => {
  try {
    const patch = {};
    if (req.body.capacity !== undefined) {
      patch.capacity = req.body.capacity === null || req.body.capacity === '' ? null : Number(req.body.capacity);
    }
    for (const k of ['title', 'description', 'location', 'startsAt', 'endsAt']) {
      if (req.body[k] !== undefined) patch[k] = req.body[k];
    }
    const { promoted } = svc.editEvent(req.params.id, req.user.id, patch);
    res.json({ event: svc.eventWithCounts(svc.getEvent(req.params.id), req.user.id), promotedCount: promoted.length });
  } catch (e) { next(e); }
});

router.post('/:id/cancel', requireAuth, (req, res, next) => {
  try {
    svc.cancelEvent(req.params.id, req.user.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/:id/rsvp', requireAuth, (req, res, next) => {
  try {
    const result = svc.rsvp(req.params.id, req.user.id);
    res.status(result.reactivated ? 200 : 201).json({ rsvp: result, event: svc.eventWithCounts(svc.getEvent(req.params.id), req.user.id) });
  } catch (e) { next(e); }
});

router.post('/:id/rsvp/cancel', requireAuth, (req, res, next) => {
  try {
    const result = svc.cancelRsvp(req.params.id, req.user.id);
    res.json({ ...result, promotedCount: result.promoted.length, event: svc.eventWithCounts(svc.getEvent(req.params.id), req.user.id) });
  } catch (e) { next(e); }
});

router.get('/:id/attendees', requireAuth, (req, res, next) => {
  try { res.json({ attendees: svc.attendeeList(req.params.id, req.user.id) }); } catch (e) { next(e); }
});

export default router;
