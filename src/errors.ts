export class WishopError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends WishopError {}

export class AuthenticationError extends WishopError {}

export class PermissionError extends WishopError {}

export class NotFoundError extends WishopError {}

export class ConflictError extends WishopError {}

export class ChargeExpiredError extends WishopError {}

export class PayloadTooLargeError extends WishopError {}

export class UnprocessableError extends WishopError {}

export class RateLimitError extends WishopError {
  readonly retryAfter: number | null;

  constructor(message: string, status: number, retryAfter: number | null = null) {
    super(message, status);
    this.retryAfter = retryAfter;
  }
}

export class ApiError extends WishopError {}

export class ConnectionError extends WishopError {}

export class SignatureVerificationError extends WishopError {}

const BY_STATUS: Record<number, new (message: string, status: number) => WishopError> = {
  400: ValidationError,
  401: AuthenticationError,
  403: PermissionError,
  404: NotFoundError,
  409: ConflictError,
  410: ChargeExpiredError,
  413: PayloadTooLargeError,
  422: UnprocessableError,
};

export function errorFor(
  status: number,
  message: string,
  retryAfter: number | null,
): WishopError {
  if (status === 429) {
    return new RateLimitError(message, status, retryAfter);
  }

  const Constructor = BY_STATUS[status] ?? ApiError;

  return new Constructor(message, status);
}
