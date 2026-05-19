import { useEffect } from "react";
import { BrandLogo } from "@/components/brand-logo";

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

export default function AuthSsoCallback() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash || "";
    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    const token = params.get("token");
    const base = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "") || "/";
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      // Clear any cached user object so the auth hook re-fetches /api/auth/me
      // with the new token (which may have a different role, name, etc).
      localStorage.removeItem(USER_KEY);
      // Replace the URL so the token never lingers in history.
      window.location.replace(base);
    } else {
      window.location.replace(`${base}/?error=sso_failed`);
    }
  }, []);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-background px-4">
      <BrandLogo variant="full" size="xl" className="mb-6" />
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Signing you in…
      </div>
    </div>
  );
}
