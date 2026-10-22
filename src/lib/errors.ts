/**
 * Application error vocabulary shared by services and route handlers.
 * Codes and statuses follow docs/API_DOCUMENTATION.md §0.
 */
export const ERROR_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SLOT_UNAVAILABLE: 409,
  INVALID_TRANSITION: 409,
  VERSION_CONFLICT: 409,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  VALIDATION_FAILED: 422,
  BOOKING_DISABLED: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  BAD_REQUEST: "The request could not be read.",
  UNAUTHENTICATED: "Please sign in to continue.",
  FORBIDDEN: "You do not have permission to do this.",
  NOT_FOUND: "We could not find what you were looking for.",
  SLOT_UNAVAILABLE: "That time has just been taken. Please choose another time.",
  INVALID_TRANSITION: "This change is not allowed for the appointment's current status.",
  VERSION_CONFLICT: "These settings were changed by someone else. Reload and try again.",
  CONFLICT: "This conflicts with existing data.",
  PAYLOAD_TOO_LARGE: "The request is too large.",
  UNSUPPORTED_MEDIA_TYPE: "Unsupported content type.",
  VALIDATION_FAILED: "Please correct the highlighted fields.",
  BOOKING_DISABLED: "Online booking is not available right now. Please call the clinic.",
  RATE_LIMITED: "Too many attempts. Please wait a little and try again.",
  INTERNAL: "Something went wrong on our side. Please try again.",
  SERVICE_UNAVAILABLE: "The service is temporarily unavailable. Please try again shortly.",
};

export type FieldErrors = Record<string, string>;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields?: FieldErrors;
  /** Extra, client-safe data (e.g. alternative slots, retryAfter seconds). */
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, options: { message?: string; fields?: FieldErrors; details?: Record<string, unknown>; cause?: unknown } = {}) {
    super(options.message ?? DEFAULT_MESSAGES[code], { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.fields = options.fields;
    this.details = options.details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** MongoDB duplicate-key error (E11000), optionally for a specific index key. */
export function isDuplicateKeyError(error: unknown, keyField?: string): boolean {
  if (!error || typeof error !== "object" || (error as { code?: unknown }).code !== 11000) return false;
  if (!keyField) return true;
  const keyPattern = (error as { keyPattern?: Record<string, unknown> }).keyPattern;
  return Boolean(keyPattern && keyField in keyPattern);
}

/** Network/server-selection failures from the driver. */
export function isDatabaseUnavailableError(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name ?? "";
  return /MongoServerSelectionError|MongooseServerSelectionError|MongoNetworkError|MongoNotConnectedError/.test(name);
}

export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;
  if (isDatabaseUnavailableError(error)) return new AppError("SERVICE_UNAVAILABLE", { cause: error });
  return new AppError("INTERNAL", { cause: error });
}

export type ErrorBody = {
  error: { code: ErrorCode; message: string; fields?: FieldErrors; requestId: string } & Record<string, unknown>;
};

export function errorBody(error: AppError, requestId: string): ErrorBody {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.fields ? { fields: error.fields } : {}),
      ...(error.details ?? {}),
      requestId,
    },
  };
}
