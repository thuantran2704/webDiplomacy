// Standard error classes and response envelope formatter.

export class AppError extends Error {
  constructor(message, code, status) {
    super(message);
    this.code   = code;
    this.status = status;
  }
}

export class NotFoundError extends AppError {
  constructor(msg = "Not found", code = "NOT_FOUND") {
    super(msg, code, 404);
  }
}

export class ConflictError extends AppError {
  constructor(msg, code = "CONFLICT") {
    super(msg, code, 409);
  }
}

export class ValidationError extends AppError {
  constructor(msg, code = "VALIDATION_ERROR") {
    super(msg, code, 400);
  }
}

export class NotImplementedError extends AppError {
  constructor(method) {
    super(`${method} is not implemented by this adapter`, "NOT_IMPLEMENTED", 500);
  }
}

/** Express error-handling middleware. */
export function errorHandler(err, _req, res, _next) {
  const status  = err.status  ?? 500;
  const code    = err.code    ?? "INTERNAL_ERROR";
  const message = status < 500 ? err.message : "Internal server error";
  if (status >= 500) console.error("[error]", err);
  res.status(status).json({ error: message, code });
}
