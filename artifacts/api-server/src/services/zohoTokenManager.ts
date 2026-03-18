import axios from "axios";

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

const tokenCache = new Map<string, CachedToken>();

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

export async function getZohoAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  domain: string = "https://accounts.zoho.com",
): Promise<string> {
  const cacheKey = `${clientId}:${refreshToken}`;
  const cached = tokenCache.get(cacheKey);

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

  const { access_token, expires_in } = response.data;

  if (!access_token) {
    throw new Error(response.data.error || "Failed to obtain Zoho access token");
  }

  const expiresInMs = (expires_in || 3600) * 1000;

  tokenCache.set(cacheKey, {
    accessToken: access_token,
    expiresAt: Date.now() + expiresInMs,
  });

  return access_token;
}

export function clearTokenCache(clientId: string, refreshToken: string): void {
  tokenCache.delete(`${clientId}:${refreshToken}`);
}
