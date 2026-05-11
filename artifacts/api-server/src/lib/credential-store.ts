import { db } from "@workspace/db";
import { userCredentials } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "./crypto";
import { invalidateDashboardCache } from "./dashboard-cache";

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
}

export async function deleteUserCredentials(userId: number, provider: string): Promise<void> {
  await db
    .delete(userCredentials)
    .where(and(eq(userCredentials.userId, userId), eq(userCredentials.provider, provider)));
  invalidateDashboardCache(userId);
}

export async function listUserConnections(userId: number) {
  const creds = await db
    .select({
      provider: userCredentials.provider,
      instanceUrl: userCredentials.instanceUrl,
      createdAt: userCredentials.createdAt,
      updatedAt: userCredentials.updatedAt,
    })
    .from(userCredentials)
    .where(eq(userCredentials.userId, userId));

  return creds.map((c) => ({
    provider: c.provider,
    instanceUrl: c.instanceUrl,
    connected: true,
    connectedAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
}
