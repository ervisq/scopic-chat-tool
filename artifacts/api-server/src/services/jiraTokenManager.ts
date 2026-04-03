import axios from "axios";
import crypto from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

const TOKEN_BUFFER_MS = 60_000;
const JIRA_TOKEN_URL = "https://auth.atlassian.com/oauth/token";

function deriveCacheKey(clientId: string, refreshToken: string): string {
  return "jira_" + crypto
    .createHmac("sha256", clientId)
    .update(refreshToken)
    .digest("hex");
}

async function ensureTokenCacheTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS zoho_token_cache (
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
    sql`SELECT access_token, expires_at FROM zoho_token_cache WHERE cache_key = ${cacheKey} LIMIT 1`
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
    sql`INSERT INTO zoho_token_cache (cache_key, access_token, expires_at, updated_at)
        VALUES (${cacheKey}, ${token.accessToken}, ${token.expiresAt}, NOW())
        ON CONFLICT (cache_key) DO UPDATE SET
          access_token = EXCLUDED.access_token,
          expires_at = EXCLUDED.expires_at,
          updated_at = NOW()`
  );
}

export interface JiraTokenResult {
  accessToken: string;
  newRefreshToken?: string;
}

export async function getJiraAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<JiraTokenResult> {
  const cacheKey = deriveCacheKey(clientId, refreshToken);
  const cached = await getCachedToken(cacheKey);

  if (cached && cached.expiresAt > Date.now() + TOKEN_BUFFER_MS) {
    return { accessToken: cached.accessToken };
  }

  const response = await axios.post(
    JIRA_TOKEN_URL,
    {
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    },
    { headers: { "Content-Type": "application/json" } },
  );

  const { access_token, refresh_token: rotatedRefreshToken, expires_in, error: tokenError, error_description } = response.data;

  if (!access_token) {
    const errMsg = error_description || tokenError || "Failed to obtain Jira access token";
    console.error("Jira token refresh failed:", JSON.stringify(response.data));
    if (tokenError === "invalid_grant") {
      throw new Error("Jira authorization expired. Please disconnect and reconnect Jira in Connected Services.");
    }
    throw new Error(errMsg);
  }

  const expiresInMs = (expires_in || 3600) * 1000;

  const newCacheKey = rotatedRefreshToken ? deriveCacheKey(clientId, rotatedRefreshToken) : cacheKey;

  await setCachedToken(newCacheKey, {
    accessToken: access_token,
    expiresAt: Date.now() + expiresInMs,
  });

  return {
    accessToken: access_token,
    newRefreshToken: rotatedRefreshToken && rotatedRefreshToken !== refreshToken ? rotatedRefreshToken : undefined,
  };
}
