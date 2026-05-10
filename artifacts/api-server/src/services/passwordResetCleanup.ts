import { db } from "@workspace/db";
import { passwordResetTokens } from "@workspace/db/schema";
import { sql } from "drizzle-orm";

const USED_RETENTION_DAYS = 30;
const EXPIRED_RETENTION_DAYS = 7;

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;

export async function cleanupPasswordResetTokens(): Promise<number> {
  const result = await db
    .delete(passwordResetTokens)
    .where(
      sql`(${passwordResetTokens.usedAt} IS NOT NULL AND ${passwordResetTokens.createdAt} < now() - (${USED_RETENTION_DAYS} || ' days')::interval) OR (${passwordResetTokens.expiresAt} < now() - (${EXPIRED_RETENTION_DAYS} || ' days')::interval)`,
    );

  const count = result.rowCount ?? 0;
  console.log(
    `[password-reset-cleanup] Removed ${count} expired/used password reset token row(s).`,
  );
  return count;
}

export function startPasswordResetCleanupJob(
  intervalMs: number = DEFAULT_INTERVAL_MS,
): NodeJS.Timeout {
  void cleanupPasswordResetTokens().catch((err) => {
    console.error("[password-reset-cleanup] Initial run failed:", err);
  });

  const timer = setInterval(() => {
    void cleanupPasswordResetTokens().catch((err) => {
      console.error("[password-reset-cleanup] Scheduled run failed:", err);
    });
  }, intervalMs);

  if (typeof timer.unref === "function") {
    timer.unref();
  }
  return timer;
}
