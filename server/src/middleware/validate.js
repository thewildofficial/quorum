import { badRequest } from '../errors.js';

export function isNonEmptyString(v, max = 5000) {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max;
}
export function isEmail(v) {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;
}
export function isNumberInRange(v, min, max) {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
}
export function requireFields(body, fields) {
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null);
  if (missing.length) throw badRequest(`Missing required field(s): ${missing.join(', ')}`);
}
export function assert(cond, message, details) {
  if (!cond) throw badRequest(message, details);
}
