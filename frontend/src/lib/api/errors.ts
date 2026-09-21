export type ApiErrorEnvelope = {
  error?: {
    code?: unknown;
    message?: unknown;
    fields?: unknown;
  };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string[]>;

  constructor(options: {
    status: number;
    code: string;
    message: string;
    fields?: Record<string, string[]>;
  }) {
    super(options.message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.fields = options.fields ?? {};
  }
}

function normalizeFields(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([field, messages]) => [
      field,
      Array.isArray(messages)
        ? messages.map(String)
        : [String(messages)],
    ]),
  );
}

export async function createApiError(response: Response): Promise<ApiError> {
  let payload: ApiErrorEnvelope = {};
  try {
    payload = (await response.json()) as ApiErrorEnvelope;
  } catch {
    // The status-based fallback below intentionally handles non-JSON failures.
  }

  const error = payload.error;
  return new ApiError({
    status: response.status,
    code: typeof error?.code === "string" ? error.code : "request_failed",
    message:
      typeof error?.message === "string"
        ? error.message
        : `The request failed with status ${response.status}.`,
    fields: normalizeFields(error?.fields),
  });
}
