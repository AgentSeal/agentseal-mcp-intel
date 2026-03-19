/** Discriminated error codes for all AgentSeal API failure modes. */
export type ApiErrorCode =
  | "RATE_LIMITED"
  | "AUTH_REQUIRED"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "SERVER_ERROR"
  | "NETWORK_ERROR"
  | "TIMEOUT";

/** Base class for all AgentSeal API errors. */
export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly statusCode?: number,
    /** Seconds to wait before retrying (from Retry-After header). */
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Thrown when the free tier daily limit is exceeded. */
export class RateLimitError extends ApiError {
  constructor(retryAfter: number) {
    super(
      "RATE_LIMITED",
      `Rate limit exceeded. Retry after ${retryAfter}s.`,
      429,
      retryAfter,
    );
    this.name = "RateLimitError";
  }
}

/**
 * Thrown when the request requires a Pro API key.
 * Free tier requests return basic data; Pro returns full findings + evidence.
 */
export class AuthError extends ApiError {
  constructor() {
    super(
      "AUTH_REQUIRED",
      "Pro API key required. Set AGENTSEAL_API_KEY to unlock full security findings.",
      403,
    );
    this.name = "AuthError";
  }
}

/** Thrown when a server or resource is not found in the registry. */
export class NotFoundError extends ApiError {
  constructor(public readonly resource: string) {
    super("NOT_FOUND", `Not found in registry: ${resource}`, 404);
    this.name = "NotFoundError";
  }
}
