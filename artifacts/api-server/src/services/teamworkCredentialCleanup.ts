import { db } from "@workspace/db";
import { userCredentials } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import { decrypt } from "../lib/crypto";

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Teamwork was migrated from API-token auth to OAuth2. Rows saved under
 * the old flow have credentials shaped { apiToken } and lack the OAuth
 * fields the runtime needs to obtain an access token (specifically the
 * refresh_token used by getTeamworkAccessToken to call the token
 * endpoint). The connections list already shows these as "not
 * connected", but the encrypted row is still sitting in user_credentials.
 * This job removes those rows.
 *
 * Safety:
 * - Only rows that decrypt and decode successfully AND are confirmed to
 *   lack a non-empty refreshToken are deleted. This is the same
 *   "connected" check used by listUserConnections().
 * - Rows whose ciphertext fails to decrypt/parse are NOT deleted. A
 *   transient crypto misconfiguration must not wipe credentials; those
 *   rows are skipped and counted for visibility only.
 * - Idempotent: running it again with no orphans removes nothing.
 */
export async function cleanupOrphanedTeamworkCredentials(): Promise<number> {
  const rows = await db
    .select({
      id: userCredentials.id,
      credentialsEncrypted: userCredentials.credentialsEncrypted,
    })
    .from(userCredentials)
    .where(eq(userCredentials.provider, "teamwork"));

  const orphanIds: number[] = [];
  let undecodable = 0;
  for (const row of rows) {
    let decoded: Record<string, unknown> | null = null;
    try {
      decoded = JSON.parse(decrypt(row.credentialsEncrypted)) as Record<string, unknown>;
    } catch {
      decoded = null;
    }
    if (decoded === null) {
      undecodable += 1;
      continue;
    }
    // A valid OAuth row has either a refresh token or (for Teamwork's
    // long-lived-token flow) an access token. Only legacy { apiToken } rows
    // lack both and should be treated as orphans.
    const hasRefreshToken =
      typeof decoded.refreshToken === "string" && (decoded.refreshToken as string).length > 0;
    const hasAccessToken =
      typeof decoded.accessToken === "string" && (decoded.accessToken as string).length > 0;
    if (!hasRefreshToken && !hasAccessToken) {
      orphanIds.push(row.id);
    }
  }

  if (undecodable > 0) {
    console.warn(
      `[teamwork-credential-cleanup] Skipped ${undecodable} Teamwork credential row(s) that could not be decrypted/parsed; leaving them in place.`,
    );
  }

  if (orphanIds.length === 0) {
    console.log("[teamwork-credential-cleanup] No orphaned Teamwork credential rows found.");
    return 0;
  }

  const result = await db
    .delete(userCredentials)
    .where(inArray(userCredentials.id, orphanIds));

  const count = result.rowCount ?? orphanIds.length;
  console.log(
    `[teamwork-credential-cleanup] Removed ${count} orphaned Teamwork credential row(s) left over from the pre-OAuth flow.`,
  );
  return count;
}

export function startTeamworkCredentialCleanupJob(
  intervalMs: number = DEFAULT_INTERVAL_MS,
): NodeJS.Timeout {
  void cleanupOrphanedTeamworkCredentials().catch((err) => {
    console.error("[teamwork-credential-cleanup] Initial run failed:", err);
  });

  const timer = setInterval(() => {
    void cleanupOrphanedTeamworkCredentials().catch((err) => {
      console.error("[teamwork-credential-cleanup] Scheduled run failed:", err);
    });
  }, intervalMs);

  if (typeof timer.unref === "function") {
    timer.unref();
  }
  return timer;
}
