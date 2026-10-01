export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    if (details) this.details = details;
  }
}
export const httpError = (status, message, details) => new HttpError(status, message, details);
