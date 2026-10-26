import { Router } from 'express';
import { badRequest } from '../errors.js';
import { requireAuth, requireOrganizer } from '../middleware/auth.js';
import { requireFields, isNonEmptyString } from '../middleware/validate.js';
import * as svc from '../services/eventService.js';

const router = Router();
// Express 4 does not catch async rejections; wrap handlers.
const ah = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// Public discovery (Luma-style: event pages are viewable without an account)
router.get('/', ah(async (req, res) => {
  const { when, q } = req.query;
  if (when && !['upcoming', 'past', 'all'].includes(when)) throw badRequest('Invalid time filter');
  res.json({ events: await svc.listEvents({ when: when || 'upcoming', q: q ? String(q).slice(0, 200) : null, userId: req.user?.id }) });
}));

router.get('/mine/rsvps', requireAuth, ah(async (req, res) => {
  res.json({ events: await svc.myRsvps(req.user.id) });
}));

router.get('/:id', ah(async (req, res) => {
  res.json({ event: await svc.eventWithCounts(await svc.getEvent(req.params.id), req.user?.id) });
}));

router.post('/', requireOrganizer, ah(async (req, res) => {
  requireFields(req.body, ['title', 'startsAt', 'endsAt']);
  if (!isNonEmptyString(req.body.title, 140)) throw badRequest('Title is required (max 140 chars)');
  const capacity = req.body.capacity === null || req.body.capacity === undefined || req.body.capacity === ''
    ? null : Number(req.body.capacity);
  const event = await svc.publishEvent(req.user.id, {
    title: req.body.title,
    description: String(req.body.description || '').slice(0, 5000),
    location: String(req.body.location || '').slice(0, 300),
    startsAt: req.body.startsAt,
    endsAt: req.body.endsAt,
    capacity,
  });
  res.status(201).json({ event: await svc.eventWithCounts(event, req.user.id) });
}));

router.patch('/:id', requireAuth, ah(async (req, res) => {
  const patch = {};
  if (req.body.capacity !== undefined) {
    patch.capacity = req.body.capacity === null || req.body.capacity === '' ? null : Number(req.body.capacity);
  }
  for (const k of ['title', 'description', 'location', 'startsAt', 'endsAt']) {
    if (req.body[k] !== undefined) patch[k] = req.body[k];
  }
  const { promoted } = await svc.editEvent(req.params.id, req.user.id, patch);
  res.json({ event: await svc.eventWithCounts(await svc.getEvent(req.params.id), req.user.id), promotedCount: promoted.length });
}));

router.post('/:id/cancel', requireAuth, ah(async (req, res) => {
  await svc.cancelEvent(req.params.id, req.user.id);
  res.json({ ok: true });
}));

router.post('/:id/rsvp', requireAuth, ah(async (req, res) => {
  const result = await svc.rsvp(req.params.id, req.user.id);
  res.status(result.reactivated ? 200 : 201).json({ rsvp: result, event: await svc.eventWithCounts(await svc.getEvent(req.params.id), req.user.id) });
}));

router.post('/:id/rsvp/cancel', requireAuth, ah(async (req, res) => {
  const result = await svc.cancelRsvp(req.params.id, req.user.id);
  res.json({ ...result, promotedCount: result.promoted.length, event: await svc.eventWithCounts(await svc.getEvent(req.params.id), req.user.id) });
}));

router.get('/:id/attendees', requireAuth, ah(async (req, res) => {
  res.json({ attendees: await svc.attendeeList(req.params.id, req.user.id) });
}));

export default router;
