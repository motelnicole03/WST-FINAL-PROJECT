/** An error with an HTTP status code, thrown by services and handled in errorHandler. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static badRequest(message = 'Bad request') {
    return new HttpError(400, message);
  }
  static unauthorized(message = 'Authentication required') {
    return new HttpError(401, message);
  }
  static forbidden(message = 'You do not have access to this resource') {
    return new HttpError(403, message);
  }
  static notFound(message = 'Not found') {
    return new HttpError(404, message);
  }
  static conflict(message = 'Conflict') {
    return new HttpError(409, message);
  }
}
