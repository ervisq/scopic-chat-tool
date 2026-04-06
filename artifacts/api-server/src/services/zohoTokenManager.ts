import axios from "axios";
import crypto from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export class ZohoPermissionError extends Error {
  public readonly httpStatus: number;
  constructor(message: string, httpStatus: number) {
    super(message);
    this.name = "ZohoPermissionError";
    this.httpStatus = httpStatus;
  }
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

const TOKEN_BUFFER_MS = 60_000;

const ALLOWED_ZOHO_DOMAINS = [
  "https://accounts.zoho.com",
  "https://accounts.zoho.in",
  "https://accounts.zoho.eu",
  "https://accounts.zoho.com.au",
  "https://accounts.zoho.jp",
  "https://accounts.zoho.com.cn",
  "https://accounts.zohocloud.ca",
];

function validateZohoDomain(domain: string): string {
  const normalized = domain.replace(/\/$/, "").toLowerCase();
  const match = ALLOWED_ZOHO_DOMAINS.find((d) => d === normalized);
  if (!match) {
    throw new Error(
      `Invalid Zoho accounts domain: "${domain}". Allowed domains: ${ALLOWED_ZOHO_DOMAINS.join(", ")}`,
    );
  }
  return match;
}

function deriveCacheKey(clientId: string, refreshToken: string): string {
  return crypto
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

  await db.execute(
    sql`DELETE FROM zoho_token_cache WHERE expires_at < ${Date.now()}`
  );
}

async function deleteCachedToken(cacheKey: string): Promise<void> {
  if (!tableEnsured) {
    await ensureTokenCacheTable();
    tableEnsured = true;
  }

  await db.execute(
    sql`DELETE FROM zoho_token_cache WHERE cache_key = ${cacheKey}`
  );
}

export async function getZohoAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  domain: string = "https://accounts.zoho.com",
): Promise<string> {
  const cacheKey = deriveCacheKey(clientId, refreshToken);
  const cached = await getCachedToken(cacheKey);

  if (cached && cached.expiresAt > Date.now() + TOKEN_BUFFER_MS) {
    return cached.accessToken;
  }

  const validatedDomain = validateZohoDomain(domain);
  const tokenUrl = `${validatedDomain}/oauth/v2/token`;

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const response = await axios.post(tokenUrl, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const { access_token, expires_in, error: tokenError } = response.data;

  if (!access_token) {
    const errMsg = tokenError || "Failed to obtain Zoho access token";
    console.error("Zoho token exchange failed:", JSON.stringify(response.data));
    if (tokenError === "invalid_code" || tokenError === "invalid_client") {
      throw new Error(`Zoho authorization expired or invalid. Please disconnect Zoho in Connected Services and reconnect.`);
    }
    throw new Error(errMsg);
  }

  const expiresInMs = (expires_in || 3600) * 1000;

  await setCachedToken(cacheKey, {
    accessToken: access_token,
    expiresAt: Date.now() + expiresInMs,
  });

  return access_token;
}

export async function clearTokenCache(clientId: string, refreshToken: string): Promise<void> {
  await deleteCachedToken(deriveCacheKey(clientId, refreshToken));
}
