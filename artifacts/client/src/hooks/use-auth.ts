import { useState, useCallback, useEffect } from "react";

interface User {
  email: string;
  name: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
}

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

export function useAuth() {
  const [state, setState] = useState<AuthState>(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const userJson = localStorage.getItem(USER_KEY);
    return {
      token,
      user: userJson ? JSON.parse(userJson) : null,
      isLoading: false,
    };
  });

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
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setState({ token: data.token, user: data.user, isLoading: false });
      return { success: true as const };
    } catch (error: any) {
      setState((s) => ({ ...s, isLoading: false }));
      return { success: false as const, error: error.message };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setState({ token: null, user: null, isLoading: false });
  }, []);

  return {
    user: state.user,
    token: state.token,
    isAuthenticated: !!state.token,
    isLoading: state.isLoading,
    login,
    logout,
  };
}
