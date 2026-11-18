/**
 * An expected, user-facing error. Services throw these; the error-handler
 * middleware turns them into JSON responses. Anything that is NOT an AppError
 * is treated as an unexpected bug and answered with a generic 500.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(code: string, message: string) {
    return new AppError(400, code, message);
  }

  static unauthorized(code: string, message: string) {
    return new AppError(401, code, message);
  }

  static forbidden(code: string, message: string) {
    return new AppError(403, code, message);
  }

  static conflict(code: string, message: string) {
    return new AppError(409, code, message);
  }

  static tooManyRequests(message: string) {
    return new AppError(429, 'RATE_LIMITED', message);
  }

  static serviceUnavailable(code: string, message: string) {
    return new AppError(503, code, message);
  }
}
