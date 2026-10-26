export class ApiError extends Error {
  constructor(status, message, details = undefined) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
export const badRequest = (msg, details) => new ApiError(400, msg, details);
export const unauthorized = (msg = 'Authentication required') => new ApiError(401, msg);
export const forbidden = (msg = 'You do not have access to this resource') => new ApiError(403, msg);
export const notFound = (msg = 'Not found') => new ApiError(404, msg);
export const conflict = (msg, details) => new ApiError(409, msg, details);
export const unprocessable = (msg, details) => new ApiError(422, msg, details);
