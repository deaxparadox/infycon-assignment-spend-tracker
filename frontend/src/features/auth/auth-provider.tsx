"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { ApiClient, ApiError } from "@/lib/api/client";

import type { AuthState, LoginInput, RegistrationInput, User } from "./types";

type LoginResponse = { access: string; csrfToken: string; user: User };
type MeResponse = { user: User };

type AuthContextValue = {
  state: AuthState;
  api: ApiClient;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegistrationInput) => Promise<void>;
  logout: () => Promise<boolean>;
  retryBootstrap: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const bootstrapStartedRef = useRef(false);
  const [api] = useState(
    () =>
      new ApiClient({
        onSessionCleared: () => {
        setState({ status: "anonymous" });
        },
      }),
  );

  const bootstrap = useCallback(async () => {
    setState({ status: "loading" });
    try {
      await api.ensureCsrfToken();
      await api.refreshAccessToken();
      const { user } = await api.request<MeResponse>("/auth/me", {
        retryOnUnauthorized: false,
      });
      setState({ status: "authenticated", user });
    } catch (error) {
      api.clearSession();
      if (error instanceof ApiError && error.status === 401) {
        setState({ status: "anonymous" });
      } else {
        setState({
          status: "error",
          message: "The session could not be restored. Check your connection and retry.",
        });
      }
    }
  }, [api]);

  useEffect(() => {
    if (bootstrapStartedRef.current) {
      return;
    }
    bootstrapStartedRef.current = true;
    void bootstrap();
  }, [bootstrap]);

  const login = useCallback(
    async (input: LoginInput) => {
      const response = await api.request<LoginResponse>("/auth/login", {
        method: "POST",
        auth: false,
        cookie: true,
        csrf: true,
        retryOnUnauthorized: false,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      api.adoptSession(response.access, response.csrfToken);
      setState({ status: "authenticated", user: response.user });
    },
    [api],
  );

  const register = useCallback(
    async (input: RegistrationInput) => {
      await api.request<{ user: User }>("/auth/register", {
        method: "POST",
        auth: false,
        cookie: true,
        csrf: true,
        retryOnUnauthorized: false,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    },
    [api],
  );

  const logout = useCallback(async () => {
    let serverSessionCleared = true;
    try {
      await api.request<void>("/auth/logout", {
        method: "POST",
        auth: false,
        cookie: true,
        csrf: true,
        retryOnUnauthorized: false,
      });
    } catch {
      serverSessionCleared = false;
    } finally {
      api.clearSession();
    }
    return serverSessionCleared;
  }, [api]);

  return (
    <AuthContext.Provider
      value={{ state, api, login, register, logout, retryBootstrap: bootstrap }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return value;
}
