import { Router, type IRouter } from "express";
import crypto from "crypto";
import axios from "axios";
import { getAuthUser, verifyToken, requireAuth } from "../middlewares/auth";
import { saveUserCredentials } from "../lib/credential-store";

const router: IRouter = Router();

const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID || "";
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET || "";
const ZOHO_ACCOUNTS_URL = "https://accounts.zoho.com";
const ZOHO_SCOPES = "ZohoPeople.forms.ALL,ZohoCRM.modules.ALL,ZohoCRM.settings.ALL,ZohoRecruit.modules.ALL,ZohoRecruit.settings.ALL,ZohoContracts.contracts.ALL";

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
  return `https://${domain}/api/zoho/callback`;
}

function getFrontendUrl(): string {
  const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost";
  return `https://${domain}/`;
}

router.get("/zoho/auth-url", requireAuth, (req, res) => {
  if (!ZOHO_CLIENT_ID) {
    res.status(500).json({ message: "Zoho OAuth is not configured on this server" });
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
    scope: ZOHO_SCOPES,
    client_id: ZOHO_CLIENT_ID,
    response_type: "code",
    access_type: "offline",
    redirect_uri: getRedirectUri(),
    state: nonce,
    prompt: "consent",
  });

  const authUrl = `${ZOHO_ACCOUNTS_URL}/oauth/v2/auth?${params.toString()}`;
  res.json({ authUrl });
});

router.get("/zoho/callback", async (req, res) => {
  const { code, state, error } = req.query;
  const frontendUrl = getFrontendUrl();

  if (error) {
    console.error("Zoho OAuth error:", error);
    res.redirect(`${frontendUrl}?zoho_error=${encodeURIComponent(String(error))}`);
    return;
  }

  if (!code || !state) {
    res.redirect(`${frontendUrl}?zoho_error=missing_params`);
    return;
  }

  const nonce = String(state);
  const pending = pendingStates.get(nonce);

  if (!pending) {
    console.error("Zoho OAuth: invalid or expired state nonce");
    res.redirect(`${frontendUrl}?zoho_error=invalid_state`);
    return;
  }

  if (pending.expiresAt < Date.now()) {
    pendingStates.delete(nonce);
    res.redirect(`${frontendUrl}?zoho_error=expired_state`);
    return;
  }

  pendingStates.delete(nonce);
  const userId = pending.userId;

  try {
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: ZOHO_CLIENT_ID,
      client_secret: ZOHO_CLIENT_SECRET,
      redirect_uri: getRedirectUri(),
      code: String(code),
    });

    const tokenResponse = await axios.post(
      `${ZOHO_ACCOUNTS_URL}/oauth/v2/token`,
      tokenParams.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );

    const { access_token, refresh_token } = tokenResponse.data;

    if (!refresh_token) {
      console.error("Zoho OAuth: no refresh token received", tokenResponse.data);
      res.redirect(`${frontendUrl}?zoho_error=no_refresh_token`);
      return;
    }

    await saveUserCredentials(userId, "zoho", {
      refreshToken: refresh_token,
      modules: "people,crm,recruit,contracts",
    });

    res.redirect(`${frontendUrl}?zoho_success=true`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Zoho OAuth token exchange error:", msg);
    res.redirect(`${frontendUrl}?zoho_error=token_exchange_failed`);
  }
});

export default router;
