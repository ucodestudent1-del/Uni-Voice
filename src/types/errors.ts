export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;
  public readonly context?: Record<string, unknown>;

  constructor(message: string, statusCode: number, code?: string, context?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    this.context = context;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", context?: Record<string, unknown>) {
    super(message, 404, "NOT_FOUND", context);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict", context?: Record<string, unknown>) {
    super(message, 409, "CONFLICT", context);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", context?: Record<string, unknown>) {
    super(message, 400, "VALIDATION", context);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", context?: Record<string, unknown>) {
    super(message, 401, "UNAUTHORIZED", context);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", context?: Record<string, unknown>) {
    super(message, 403, "FORBIDDEN", context);
  }
}

export class BusinessLogicError extends AppError {
  constructor(message: string, code?: string, context?: Record<string, unknown>) {
    super(message, 422, code ?? "LOGIC", context);
  }
}
