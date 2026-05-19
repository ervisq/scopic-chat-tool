import { Router, type IRouter } from "express";
import crypto from "crypto";
import axios from "axios";
import { getAuthUser, requireAuth } from "../middlewares/auth";
import { saveUserCredentials } from "../lib/credential-store";

const router: IRouter = Router();

const TEAMWORK_CLIENT_ID = process.env.TEAMWORK_CLIENT_ID || "";
const TEAMWORK_CLIENT_SECRET = process.env.TEAMWORK_CLIENT_SECRET || "";
const TEAMWORK_AUTHORIZE_URL = "https://www.teamwork.com/launchpad/login";
const TEAMWORK_TOKEN_URL = "https://www.teamwork.com/launchpad/v1/token.json";

const pendingStates = new Map<string, { userId: number; expiresAt: number }>();
const STATE_TTL_MS = 10 * 60 * 1000;

function cleanExpiredStates() {
  const now = Date.now();
  for (const [key, val] of pendingStates) {
    if (val.expiresAt < now) pendingStates.delete(key);
  }
}

function getAppDomain(): string {
  return process.env.REPLIT_DOMAINS?.split(",")[0]?.trim() || process.env.REPLIT_DEV_DOMAIN || "localhost";
}

function getRedirectUri(): string {
  return `https://${getAppDomain()}/api/teamwork/callback`;
}

function getFrontendUrl(): string {
  return `https://${getAppDomain()}/`;
}

function normalizeSiteUrl(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

router.get("/teamwork/auth-url", requireAuth, (req, res) => {
  if (!TEAMWORK_CLIENT_ID || !TEAMWORK_CLIENT_SECRET) {
    res.status(500).json({ message: "Teamwork OAuth is not configured on this server" });
    return;
  }

  const { userId } = getAuthUser(req);

  cleanExpiredStates();

  const nonce = crypto.randomBytes(32).toString("hex");
  pendingStates.set(nonce, {
    userId,
    expiresAt: Date.now() + STATE_TTL_MS,
  });

  const redirectUri = getRedirectUri();
  console.log("[TeamworkOAuth] Generating auth URL with redirect:", redirectUri);

  const params = new URLSearchParams({
    client_id: TEAMWORK_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    state: nonce,
  });

  const authUrl = `${TEAMWORK_AUTHORIZE_URL}?${params.toString()}`;
  res.json({ authUrl });
});

router.get("/teamwork/callback", async (req, res) => {
  const { code, state, error } = req.query;
  const frontendUrl = getFrontendUrl();

  if (error) {
    console.error("Teamwork OAuth error:", error);
    res.redirect(`${frontendUrl}?teamwork_error=${encodeURIComponent(String(error))}`);
    return;
  }

  if (!code || !state) {
    res.redirect(`${frontendUrl}?teamwork_error=missing_params`);
    return;
  }

  const nonce = String(state);
  const pending = pendingStates.get(nonce);

  if (!pending) {
    console.error("Teamwork OAuth: invalid or expired state nonce");
    res.redirect(`${frontendUrl}?teamwork_error=invalid_state`);
    return;
  }

  if (pending.expiresAt < Date.now()) {
    pendingStates.delete(nonce);
    res.redirect(`${frontendUrl}?teamwork_error=expired_state`);
    return;
  }

  pendingStates.delete(nonce);
  const userId = pending.userId;

  try {
    const tokenResponse = await axios.post(
      TEAMWORK_TOKEN_URL,
      {
        grant_type: "authorization_code",
        code: String(code),
        client_id: TEAMWORK_CLIENT_ID,
        client_secret: TEAMWORK_CLIENT_SECRET,
        redirect_uri: getRedirectUri(),
      },
      { headers: { "Content-Type": "application/json", Accept: "application/json" } },
    );

    const data = tokenResponse.data || {};
    const accessToken: string | undefined = data.access_token;
    const refreshToken: string | undefined = data.refresh_token;
    const expiresIn: number | undefined =
      typeof data.expires_in === "number" ? data.expires_in : undefined;
    const installation = (data.installation || {}) as Record<string, unknown>;
    const user = (data.user || {}) as Record<string, unknown>;

    const rawSiteUrl =
      (installation.apiEndPoint as string | undefined) ||
      (installation.url as string | undefined) ||
      (user.url as string | undefined);
    const siteUrl = normalizeSiteUrl(rawSiteUrl);

    if (!accessToken) {
      console.error("Teamwork OAuth: no access token received", data);
      res.redirect(`${frontendUrl}?teamwork_error=no_access_token`);
      return;
    }

    if (!refreshToken) {
      console.error("Teamwork OAuth: no refresh token received", data);
      res.redirect(`${frontendUrl}?teamwork_error=no_refresh_token`);
      return;
    }

    if (!siteUrl) {
      console.error("Teamwork OAuth: no site URL returned in installation", data);
      res.redirect(`${frontendUrl}?teamwork_error=no_site_url`);
      return;
    }

    await saveUserCredentials(
      userId,
      "teamwork",
      { refreshToken },
      siteUrl,
    );

    // Seed the token cache with the access_token we just got so the very first
    // API call after connect doesn't need to immediately refresh.
    if (expiresIn) {
      try {
        const { seedAccessTokenCache } = await import("../services/teamworkTokenManager");
        await seedAccessTokenCache(refreshToken, accessToken, expiresIn);
      } catch (cacheErr) {
        console.warn("[TeamworkOAuth] failed to seed token cache:", (cacheErr as Error).message);
      }
    }

    res.redirect(`${frontendUrl}?teamwork_success=1`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Teamwork OAuth token exchange error:", msg);
    res.redirect(`${frontendUrl}?teamwork_error=token_exchange_failed`);
  }
});

export default router;
