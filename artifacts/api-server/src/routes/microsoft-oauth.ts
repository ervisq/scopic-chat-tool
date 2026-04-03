import { Router, type IRouter } from "express";
import crypto from "crypto";
import axios from "axios";
import { getAuthUser, requireAuth } from "../middlewares/auth";
import { saveUserCredentials } from "../lib/credential-store";

const router: IRouter = Router();

const MS_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || "";
const MS_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || "";
const MS_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MS_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const MS_SCOPES = "Mail.Read Calendars.Read Contacts.Read User.Read offline_access";

const pendingStates = new Map<string, { userId: number; expiresAt: number }>();
const STATE_TTL_MS = 10 * 60 * 1000;

function cleanExpiredStates() {
  const now = Date.now();
  for (const [key, val] of pendingStates) {
    if (val.expiresAt < now) pendingStates.delete(key);
  }
}

function getRedirectUri(): string {
  const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost";
  return `https://${domain}/api/microsoft/callback`;
}

function getFrontendUrl(): string {
  const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost";
  return `https://${domain}/`;
}

router.get("/microsoft/auth-url", requireAuth, (req, res) => {
  if (!MS_CLIENT_ID) {
    res.status(500).json({ message: "Microsoft OAuth is not configured on this server" });
    return;
  }

  const { userId } = getAuthUser(req);

  cleanExpiredStates();

  const nonce = crypto.randomBytes(32).toString("hex");
  pendingStates.set(nonce, {
    userId,
    expiresAt: Date.now() + STATE_TTL_MS,
  });

  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    response_type: "code",
    redirect_uri: getRedirectUri(),
    scope: MS_SCOPES,
    state: nonce,
    prompt: "consent",
    response_mode: "query",
  });

  const authUrl = `${MS_AUTH_URL}?${params.toString()}`;
  res.json({ authUrl });
});

router.get("/microsoft/callback", async (req, res) => {
  const { code, state, error, error_description } = req.query;
  const frontendUrl = getFrontendUrl();

  if (error) {
    console.error("Microsoft OAuth error:", error, error_description);
    res.redirect(`${frontendUrl}?microsoft_error=${encodeURIComponent(String(error))}`);
    return;
  }

  if (!code || !state) {
    res.redirect(`${frontendUrl}?microsoft_error=missing_params`);
    return;
  }

  const nonce = String(state);
  const pending = pendingStates.get(nonce);

  if (!pending) {
    console.error("Microsoft OAuth: invalid or expired state nonce");
    res.redirect(`${frontendUrl}?microsoft_error=invalid_state`);
    return;
  }

  if (pending.expiresAt < Date.now()) {
    pendingStates.delete(nonce);
    res.redirect(`${frontendUrl}?microsoft_error=expired_state`);
    return;
  }

  pendingStates.delete(nonce);
  const userId = pending.userId;

  try {
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: MS_CLIENT_ID,
      client_secret: MS_CLIENT_SECRET,
      redirect_uri: getRedirectUri(),
      code: String(code),
      scope: MS_SCOPES,
    });

    const tokenResponse = await axios.post(MS_TOKEN_URL, tokenParams.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const { refresh_token } = tokenResponse.data;

    if (!refresh_token) {
      console.error("Microsoft OAuth: no refresh token received", tokenResponse.data);
      res.redirect(`${frontendUrl}?microsoft_error=no_refresh_token`);
      return;
    }

    await saveUserCredentials(userId, "microsoft", {
      refreshToken: refresh_token,
      modules: "mail,calendar,contacts",
    });

    res.redirect(`${frontendUrl}?microsoft_success=true`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Microsoft OAuth token exchange error:", msg);
    res.redirect(`${frontendUrl}?microsoft_error=token_exchange_failed`);
  }
});

export default router;
