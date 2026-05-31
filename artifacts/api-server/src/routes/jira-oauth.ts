import { Router, type IRouter } from "express";
import crypto from "crypto";
import axios from "axios";
import { getAuthUser, requireAuth } from "../middlewares/auth";
import { saveUserCredentials } from "../lib/credential-store";

const router: IRouter = Router();

const JIRA_CLIENT_ID = process.env.JIRA_CLIENT_ID || "";
const JIRA_CLIENT_SECRET = process.env.JIRA_CLIENT_SECRET || "";
const JIRA_AUTH_URL = "https://auth.atlassian.com/authorize";
const JIRA_TOKEN_URL = "https://auth.atlassian.com/oauth/token";
const JIRA_RESOURCES_URL = "https://api.atlassian.com/oauth/token/accessible-resources";
const JIRA_SCOPES = "read:jira-work read:jira-user offline_access";

/**
 * Normalize a configured host value to a bare lowercase hostname, tolerating
 * accidental protocols, ports, paths, or trailing slashes in the env var.
 */
function normalizeHost(raw: string): string {
  const trimmed = (raw || "").trim().toLowerCase();
  if (!trimmed) return "";
  try {
    return new URL(trimmed).hostname;
  } catch {
    return trimmed.replace(/^\/+/, "").split("/")[0].split(":")[0];
  }
}

/**
 * The only Atlassian site that may be connected through this app. Users who
 * belong to multiple Atlassian organizations must connect Scopic's site, not
 * a personal/other-company one. Overridable via env without a code change.
 */
export const JIRA_ALLOWED_HOST = normalizeHost(
  process.env.JIRA_ALLOWED_HOST || "scopicsoftware.atlassian.net",
);

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
  return `https://${getAppDomain()}/api/jira/callback`;
}

function getFrontendUrl(): string {
  return `https://${getAppDomain()}/`;
}

router.get("/jira/auth-url", requireAuth, (req, res) => {
  if (!JIRA_CLIENT_ID) {
    res.status(500).json({ message: "Jira OAuth is not configured on this server" });
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
    audience: "api.atlassian.com",
    client_id: JIRA_CLIENT_ID,
    scope: JIRA_SCOPES,
    redirect_uri: getRedirectUri(),
    state: nonce,
    response_type: "code",
    prompt: "consent",
  });

  const authUrl = `${JIRA_AUTH_URL}?${params.toString()}`;
  res.json({ authUrl });
});

router.get("/jira/callback", async (req, res) => {
  const { code, state, error, error_description } = req.query;
  const frontendUrl = getFrontendUrl();

  if (error) {
    console.error("Jira OAuth error:", error, error_description);
    res.redirect(`${frontendUrl}?jira_error=${encodeURIComponent(String(error))}`);
    return;
  }

  if (!code || !state) {
    res.redirect(`${frontendUrl}?jira_error=missing_params`);
    return;
  }

  const nonce = String(state);
  const pending = pendingStates.get(nonce);

  if (!pending) {
    console.error("Jira OAuth: invalid or expired state nonce");
    res.redirect(`${frontendUrl}?jira_error=invalid_state`);
    return;
  }

  if (pending.expiresAt < Date.now()) {
    pendingStates.delete(nonce);
    res.redirect(`${frontendUrl}?jira_error=expired_state`);
    return;
  }

  pendingStates.delete(nonce);
  const userId = pending.userId;

  try {
    const tokenResponse = await axios.post(
      JIRA_TOKEN_URL,
      {
        grant_type: "authorization_code",
        client_id: JIRA_CLIENT_ID,
        client_secret: JIRA_CLIENT_SECRET,
        code: String(code),
        redirect_uri: getRedirectUri(),
      },
      { headers: { "Content-Type": "application/json" } },
    );

    const { access_token, refresh_token } = tokenResponse.data;

    if (!refresh_token) {
      console.error("Jira OAuth: no refresh token received", tokenResponse.data);
      res.redirect(`${frontendUrl}?jira_error=no_refresh_token`);
      return;
    }

    let cloudId = "";
    let siteUrl = "";
    let hadAnySite = false;
    try {
      const resourcesResponse = await axios.get(JIRA_RESOURCES_URL, {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const sites = resourcesResponse.data;
      if (Array.isArray(sites) && sites.length > 0) {
        hadAnySite = true;
        // Only allow connecting Scopic's Atlassian site, even if the user has
        // access to multiple Atlassian organizations.
        const match = sites.find((site: { id?: string; url?: string }) => {
          try {
            return new URL(site.url || "").hostname.toLowerCase() === JIRA_ALLOWED_HOST;
          } catch {
            return false;
          }
        });
        if (match) {
          cloudId = match.id || "";
          siteUrl = match.url || "";
        }
      }
    } catch (resourceErr: unknown) {
      const msg = resourceErr instanceof Error ? resourceErr.message : String(resourceErr);
      console.error("Jira OAuth: failed to fetch accessible resources:", msg);
    }

    if (!cloudId) {
      if (hadAnySite) {
        // The user has Atlassian access, just not to the Scopic site.
        console.error(
          `Jira OAuth: user has Atlassian sites but none match the allowed host (${JIRA_ALLOWED_HOST})`,
        );
        res.redirect(`${frontendUrl}?jira_error=wrong_site`);
        return;
      }
      console.error("Jira OAuth: no accessible Jira sites found");
      res.redirect(`${frontendUrl}?jira_error=no_jira_site`);
      return;
    }

    await saveUserCredentials(userId, "jira", {
      refreshToken: refresh_token,
      cloudId,
      authType: "oauth",
    }, siteUrl || null);

    res.redirect(`${frontendUrl}?jira_success=true`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Jira OAuth token exchange error:", msg);
    res.redirect(`${frontendUrl}?jira_error=token_exchange_failed`);
  }
});

export default router;
