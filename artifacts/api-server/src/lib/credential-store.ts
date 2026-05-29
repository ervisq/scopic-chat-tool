import { db } from "@workspace/db";
import { userCredentials } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "./crypto";
import { invalidateDashboardCache } from "./dashboard-cache";
import { invalidateNameResolutionCache } from "./name-resolution-cache";

export async function getUserCredentials(userId: number, provider: string): Promise<{ credentials: any; instanceUrl: string | null } | null> {
  const [cred] = await db
    .select()
    .from(userCredentials)
    .where(and(eq(userCredentials.userId, userId), eq(userCredentials.provider, provider)))
    .limit(1);

  if (!cred) return null;

  try {
    const credentials = JSON.parse(decrypt(cred.credentialsEncrypted));
    return { credentials, instanceUrl: cred.instanceUrl };
  } catch {
    return null;
  }
}

export async function saveUserCredentials(
  userId: number,
  provider: string,
  credentials: Record<string, any>,
  instanceUrl?: string | null,
): Promise<void> {
  const credentialsEncrypted = encrypt(JSON.stringify(credentials));

  const existing = await db
    .select({ id: userCredentials.id })
    .from(userCredentials)
    .where(and(eq(userCredentials.userId, userId), eq(userCredentials.provider, provider)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(userCredentials)
      .set({
        credentialsEncrypted,
        instanceUrl: instanceUrl || null,
        updatedAt: new Date(),
      })
      .where(and(eq(userCredentials.userId, userId), eq(userCredentials.provider, provider)));
  } else {
    await db.insert(userCredentials).values({
      userId,
      provider,
      credentialsEncrypted,
      instanceUrl: instanceUrl || null,
    });
  }
  invalidateDashboardCache(userId);
  invalidateNameResolutionCache(userId, provider);
}

export async function deleteUserCredentials(userId: number, provider: string): Promise<void> {
  await db
    .delete(userCredentials)
    .where(and(eq(userCredentials.userId, userId), eq(userCredentials.provider, provider)));
  invalidateDashboardCache(userId);
  invalidateNameResolutionCache(userId, provider);
}

export async function listUserConnections(userId: number) {
  const creds = await db
    .select({
      provider: userCredentials.provider,
      instanceUrl: userCredentials.instanceUrl,
      credentialsEncrypted: userCredentials.credentialsEncrypted,
      createdAt: userCredentials.createdAt,
      updatedAt: userCredentials.updatedAt,
    })
    .from(userCredentials)
    .where(eq(userCredentials.userId, userId));

  return creds.map((c) => {
    // Teamwork was migrated from API-token auth to OAuth2. Legacy rows
    // (credentials shaped { apiToken }) cannot be used by the OAuth client,
    // so they must show as not-connected so the user is prompted to
    // reconnect via OAuth.
    let connected = true;
    if (c.provider === "teamwork") {
      try {
        const decoded = JSON.parse(decrypt(c.credentialsEncrypted)) as Record<string, unknown>;
        // Teamwork OAuth2 returns a long-lived access token and (usually) no
        // refresh token, so an access token alone is a valid connection.
        // Legacy { apiToken } rows have neither and stay not-connected.
        const hasRefresh = typeof decoded.refreshToken === "string" && decoded.refreshToken.length > 0;
        const hasAccess = typeof decoded.accessToken === "string" && decoded.accessToken.length > 0;
        connected = hasRefresh || hasAccess;
      } catch {
        connected = false;
      }
    }
    return {
      provider: c.provider,
      instanceUrl: c.instanceUrl,
      connected,
      connectedAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  });
}
