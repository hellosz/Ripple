export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }

  static badRequest(message: string, code = 'bad_request'): AppError {
    return new AppError(400, code, message);
  }
  static unauthorized(message = 'Not authenticated', code = 'unauthorized'): AppError {
    return new AppError(401, code, message);
  }
  static forbidden(message = 'Forbidden', code = 'forbidden'): AppError {
    return new AppError(403, code, message);
  }
  static notFound(message = 'Not found', code = 'not_found'): AppError {
    return new AppError(404, code, message);
  }
  static conflict(message: string, code = 'conflict'): AppError {
    return new AppError(409, code, message);
  }
}
