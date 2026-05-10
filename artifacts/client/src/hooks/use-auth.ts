import { useState, useCallback, useEffect } from "react";

interface User {
  email: string;
  name: string;
  phone?: string;
  profilePictureUrl?: string;
  theme?: string;
  defaultPage?: string;
  totpEnabled?: boolean;
  role?: string;
  hiddenTools?: string[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  requires2fa: boolean;
  tempToken: string | null;
}

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

function loadStoredAuth(): { token: string | null; user: User | null } {
  const token = localStorage.getItem(TOKEN_KEY);
  const userJson = localStorage.getItem(USER_KEY);
  return {
    token,
    user: userJson ? JSON.parse(userJson) : null,
  };
}

function applyTheme(theme: string) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function useAuth() {
  const [state, setState] = useState<AuthState>(() => {
    const stored = loadStoredAuth();
    if (stored.user?.theme) {
      applyTheme(stored.user.theme);
    }
    return { ...stored, isLoading: !!stored.token, requires2fa: false, tempToken: null };
  });

  useEffect(() => {
    if (!state.token) return;

    const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${state.token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Token invalid");
        return res.json();
      })
      .then((user) => {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        if (user.theme) applyTheme(user.theme);
        setState((s) => ({ ...s, user, isLoading: false }));
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setState({ token: null, user: null, isLoading: false, requires2fa: false, tempToken: null });
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Login failed");
      }

      const data = await res.json();

      if (data.requires2fa) {
        setState((s) => ({
          ...s,
          isLoading: false,
          requires2fa: true,
          tempToken: data.tempToken,
        }));
        return { success: true as const, requires2fa: true as const };
      }

      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      if (data.user?.theme) applyTheme(data.user.theme);
      setState({ token: data.token, user: data.user, isLoading: false, requires2fa: false, tempToken: null });
      return { success: true as const };
    } catch (err) {
      setState((s) => ({ ...s, isLoading: false }));
      return { success: false as const, error: err instanceof Error ? err.message : "Login failed" };
    }
  }, []);

  const verify2fa = useCallback(async (code: string) => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/auth/verify-2fa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempToken: state.tempToken, code }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Verification failed");
      }

      const data = await res.json();
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      if (data.user?.theme) applyTheme(data.user.theme);
      setState({ token: data.token, user: data.user, isLoading: false, requires2fa: false, tempToken: null });
      return { success: true as const };
    } catch (err) {
      setState((s) => ({ ...s, isLoading: false }));
      return { success: false as const, error: err instanceof Error ? err.message : "Verification failed" };
    }
  }, [state.tempToken]);

  const register = useCallback(async (email: string, password: string, name: string) => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setState((s) => ({ ...s, isLoading: false }));
        return {
          success: false as const,
          error: err.message || "Registration failed",
          field: typeof err.field === "string" ? err.field : undefined,
        };
      }

      const data = await res.json();
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      if (data.user?.theme) applyTheme(data.user.theme);
      setState({ token: data.token, user: data.user, isLoading: false, requires2fa: false, tempToken: null });
      return { success: true as const };
    } catch (err) {
      setState((s) => ({ ...s, isLoading: false }));
      return { success: false as const, error: err instanceof Error ? err.message : "Registration failed" };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    applyTheme("light");
    setState({ token: null, user: null, isLoading: false, requires2fa: false, tempToken: null });
  }, []);

  const updateUser = useCallback((updatedUser: Partial<User>) => {
    setState((s) => {
      const newUser = s.user ? { ...s.user, ...updatedUser } : null;
      if (newUser) {
        localStorage.setItem(USER_KEY, JSON.stringify(newUser));
        if (updatedUser.theme) applyTheme(updatedUser.theme);
      }
      return { ...s, user: newUser };
    });
  }, []);

  const cancel2fa = useCallback(() => {
    setState((s) => ({ ...s, requires2fa: false, tempToken: null }));
  }, []);

  return {
    user: state.user,
    token: state.token,
    isAuthenticated: !!state.token && !state.isLoading,
    isLoading: state.isLoading,
    requires2fa: state.requires2fa,
    login,
    verify2fa,
    cancel2fa,
    register,
    logout,
    updateUser,
  };
}
