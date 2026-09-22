import { getApiBaseUrl } from "@/lib/config";

import { ApiError, createApiError } from "./errors";

export type ApiRequestOptions = Omit<RequestInit, "credentials"> & {
  auth?: boolean;
  cookie?: boolean;
  csrf?: boolean;
  retryOnUnauthorized?: boolean;
};

type CsrfResponse = { csrfToken: string };
type RefreshResponse = { access: string };

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchImplementation: typeof fetch;
  private readonly onSessionCleared: () => void;
  private accessToken: string | null = null;
  private csrfToken: string | null = null;
  private csrfPromise: Promise<string> | null = null;
  private refreshPromise: Promise<string> | null = null;

  constructor(options: {
    baseUrl?: string;
    fetchImplementation?: typeof fetch;
    onSessionCleared?: () => void;
  } = {}) {
    this.baseUrl = options.baseUrl ?? getApiBaseUrl();
    this.fetchImplementation = options.fetchImplementation ?? fetch.bind(globalThis);
    this.onSessionCleared = options.onSessionCleared ?? (() => undefined);
  }

  adoptSession(accessToken: string, csrfToken?: string): void {
    this.accessToken = accessToken;
    if (csrfToken) {
      this.csrfToken = csrfToken;
    }
  }

  clearSession(): void {
    this.accessToken = null;
    this.onSessionCleared();
  }

  async ensureCsrfToken(): Promise<string> {
    if (this.csrfToken) {
      return this.csrfToken;
    }
    if (!this.csrfPromise) {
      this.csrfPromise = this.fetchJson<CsrfResponse>("/auth/csrf", {
        credentials: "include",
      })
        .then(({ csrfToken }) => {
          this.csrfToken = csrfToken;
          return csrfToken;
        })
        .finally(() => {
          this.csrfPromise = null;
        });
    }
    return this.csrfPromise;
  }

  async refreshAccessToken(): Promise<string> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.performRefresh().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    return this.performRequest<T>(path, options, false);
  }

  private async performRefresh(): Promise<string> {
    try {
      const csrfToken = await this.ensureCsrfToken();
      const result = await this.fetchJson<RefreshResponse>("/auth/refresh", {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRFToken": csrfToken },
      });
      this.accessToken = result.access;
      return result.access;
    } catch (error) {
      this.clearSession();
      throw error;
    }
  }

  private async performRequest<T>(
    path: string,
    options: ApiRequestOptions,
    hasRetried: boolean,
  ): Promise<T> {
    const {
      auth = true,
      cookie = false,
      csrf = false,
      retryOnUnauthorized = true,
      headers: providedHeaders,
      ...requestInit
    } = options;
    const headers = new Headers(providedHeaders);
    if (auth && this.accessToken) {
      headers.set("Authorization", `Bearer ${this.accessToken}`);
    }
    if (csrf) {
      headers.set("X-CSRFToken", await this.ensureCsrfToken());
    }

    const response = await this.fetchImplementation(`${this.baseUrl}${path}`, {
      ...requestInit,
      headers,
      ...(cookie ? { credentials: "include" as const } : {}),
    });

    if (
      response.status === 401 &&
      auth &&
      retryOnUnauthorized &&
      !hasRetried
    ) {
      await this.refreshAccessToken();
      return this.performRequest<T>(path, options, true);
    }
    if (!response.ok) {
      throw await createApiError(response);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  private async fetchJson<T>(
    path: string,
    options: RequestInit,
  ): Promise<T> {
    const response = await this.fetchImplementation(
      `${this.baseUrl}${path}`,
      options,
    );
    if (!response.ok) {
      throw await createApiError(response);
    }
    return (await response.json()) as T;
  }
}

export { ApiError };
