import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js";

const MS_TENANT_ID = process.env.MICROSOFT_TENANT_ID || "";
const MS_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || "";
const MS_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || "";

let cachedClient: Client | null = null;

export function isGraphConfigured(): boolean {
  return !!(MS_TENANT_ID && MS_CLIENT_ID && MS_CLIENT_SECRET);
}

export function getGraphClient(): Client {
  if (cachedClient) return cachedClient;

  if (!MS_TENANT_ID || !MS_CLIENT_ID || !MS_CLIENT_SECRET) {
    throw new Error("Microsoft Graph is not configured. MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, and MICROSOFT_CLIENT_SECRET are required.");
  }

  const credential = new ClientSecretCredential(MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET);
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ["https://graph.microsoft.com/.default"],
  });

  cachedClient = Client.initWithMiddleware({ authProvider });
  return cachedClient;
}
