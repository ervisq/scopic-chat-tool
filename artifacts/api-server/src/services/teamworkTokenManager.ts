import axios from "axios";
import crypto from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getUserCredentials } from "../lib/credential-store";

export class TeamworkPermissionError extends Error {
  public readonly httpStatus: number;
  constructor(message: string, httpStatus: number) {
    super(message);
    this.name = "TeamworkPermissionError";
    this.httpStatus = httpStatus;
  }
}

const TEAMWORK_TOKEN_URL = "https://www.teamwork.com/launchpad/v1/token.json";
const TOKEN_BUFFER_MS = 60_000;
const DEFAULT_EXPIRES_IN_SECONDS = 3600;

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

function deriveCacheKey(clientId: string, refreshToken: string): string {
  return crypto.createHmac("sha256", clientId).update(refreshToken).digest("hex");
}

async function ensureTokenCacheTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS teamwork_token_cache (
      cache_key TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      expires_at BIGINT NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
}

let tableEnsured = false;

async function getCachedToken(cacheKey: string): Promise<CachedToken | null> {
  if (!tableEnsured) {
    await ensureTokenCacheTable();
    tableEnsured = true;
  }
  const result = await db.execute(
    sql`SELECT access_token, expires_at FROM teamwork_token_cache WHERE cache_key = ${cacheKey} LIMIT 1`,
  );
  const rows = result.rows as Array<{ access_token: string; expires_at: string }>;
  if (rows.length === 0) return null;
  return {
    accessToken: rows[0].access_token,
    expiresAt: parseInt(rows[0].expires_at, 10),
  };
}

async function setCachedToken(cacheKey: string, token: CachedToken): Promise<void> {
  if (!tableEnsured) {
    await ensureTokenCacheTable();
    tableEnsured = true;
  }
  await db.execute(
    sql`INSERT INTO teamwork_token_cache (cache_key, access_token, expires_at, updated_at)
        VALUES (${cacheKey}, ${token.accessToken}, ${token.expiresAt}, NOW())
        ON CONFLICT (cache_key) DO UPDATE SET
          access_token = EXCLUDED.access_token,
          expires_at = EXCLUDED.expires_at,
          updated_at = NOW()`,
  );
  await db.execute(
    sql`DELETE FROM teamwork_token_cache WHERE expires_at < ${Date.now()}`,
  );
}

async function deleteCachedToken(cacheKey: string): Promise<void> {
  if (!tableEnsured) {
    await ensureTokenCacheTable();
    tableEnsured = true;
  }
  await db.execute(sql`DELETE FROM teamwork_token_cache WHERE cache_key = ${cacheKey}`);
}

/**
 * Used by the OAuth callback to populate the cache with the access_token
 * we received during code exchange, so the first downstream API call
 * doesn't immediately have to refresh.
 */
export async function seedAccessTokenCache(
  refreshToken: string,
  accessToken: string,
  expiresInSeconds: number,
): Promise<void> {
  const clientId = process.env.TEAMWORK_CLIENT_ID || "";
  if (!clientId) return;
  const cacheKey = deriveCacheKey(clientId, refreshToken);
  await setCachedToken(cacheKey, {
    accessToken,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  });
}

async function refreshAccessToken(refreshToken: string): Promise<CachedToken> {
  const clientId = process.env.TEAMWORK_CLIENT_ID || "";
  const clientSecret = process.env.TEAMWORK_CLIENT_SECRET || "";
  if (!clientId || !clientSecret) {
    throw new Error("Teamwork OAuth is not configured on this server");
  }

  let response;
  try {
    response = await axios.post(
      TEAMWORK_TOKEN_URL,
      {
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      },
      { headers: { "Content-Type": "application/json", Accept: "application/json" } },
    );
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number; data?: unknown } })?.response?.status;
    const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
    const tokenError = (data as Record<string, unknown> | undefined)?.error;
    console.error("Teamwork token refresh failed:", status, tokenError, data);
    if (tokenError === "invalid_grant" || status === 400 || status === 401 || status === 403) {
      throw new TeamworkPermissionError(
        "Your Teamwork authorization has expired or been revoked. Please reconnect Teamwork in Connected Services.",
        status || 401,
      );
    }
    throw err;
  }

  const { access_token, expires_in, error: tokenError } = response.data || {};
  if (!access_token) {
    console.error("Teamwork token refresh: no access_token in response", response.data);
    if (tokenError === "invalid_grant") {
      throw new TeamworkPermissionError(
        "Your Teamwork authorization has expired or been revoked. Please reconnect Teamwork in Connected Services.",
        401,
      );
    }
    throw new Error("Failed to obtain Teamwork access token");
  }

  const expiresInMs = (typeof expires_in === "number" ? expires_in : DEFAULT_EXPIRES_IN_SECONDS) * 1000;
  return { accessToken: access_token, expiresAt: Date.now() + expiresInMs };
}

/**
 * Returns a valid Teamwork access token for the given user, refreshing it
 * via the stored refresh_token when necessary. Throws TeamworkPermissionError
 * when the refresh token is no longer valid (user must reconnect).
 *
 * Returns null when the user has no Teamwork credentials saved, or when
 * their stored row is a legacy { apiToken } shape from the pre-OAuth
 * connection flow.
 */
export async function getTeamworkAccessToken(userId: number): Promise<{ accessToken: string; siteUrl: string } | null> {
  const cred = await getUserCredentials(userId, "teamwork");
  if (!cred) return null;

  const refreshToken = cred.credentials?.refreshToken as string | undefined;
  const siteUrl = cred.instanceUrl;
  if (!refreshToken || !siteUrl) return null;

  const clientId = process.env.TEAMWORK_CLIENT_ID || "";
  if (!clientId) {
    throw new Error("Teamwork OAuth is not configured on this server");
  }
  const cacheKey = deriveCacheKey(clientId, refreshToken);

  const cached = await getCachedToken(cacheKey);
  if (cached && cached.expiresAt > Date.now() + TOKEN_BUFFER_MS) {
    return { accessToken: cached.accessToken, siteUrl };
  }

  try {
    const fresh = await refreshAccessToken(refreshToken);
    await setCachedToken(cacheKey, fresh);
    return { accessToken: fresh.accessToken, siteUrl };
  } catch (err) {
    if (err instanceof TeamworkPermissionError) {
      // Drop the cached token so we don't keep handing out something that's
      // already known dead.
      await deleteCachedToken(cacheKey).catch(() => {});
    }
    throw err;
  }
}
