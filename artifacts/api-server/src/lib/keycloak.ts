import { Issuer, generators, type Client } from "openid-client";

let cachedClient: Client | null = null;
let discoveryError: Error | null = null;

export function getKeycloakConfig(): {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
} {
  const issuerUrl = process.env.KEYCLOAK_ISSUER_URL;
  const clientId = process.env.KEYCLOAK_CLIENT_ID;
  const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET;
  if (!issuerUrl || !clientId || !clientSecret) {
    throw new Error(
      "Keycloak is not configured. Set KEYCLOAK_ISSUER_URL, KEYCLOAK_CLIENT_ID, KEYCLOAK_CLIENT_SECRET.",
    );
  }
  return { issuerUrl, clientId, clientSecret };
}

export async function getKeycloakClient(): Promise<Client> {
  if (cachedClient) return cachedClient;
  const { issuerUrl, clientId, clientSecret } = getKeycloakConfig();
  try {
    const issuer = await Issuer.discover(issuerUrl);
    cachedClient = new issuer.Client({
      client_id: clientId,
      client_secret: clientSecret,
      response_types: ["code"],
    });
    discoveryError = null;
    return cachedClient;
  } catch (err) {
    discoveryError = err instanceof Error ? err : new Error(String(err));
    throw discoveryError;
  }
}

export { generators };
