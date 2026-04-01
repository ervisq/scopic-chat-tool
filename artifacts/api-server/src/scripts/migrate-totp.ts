import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { reEncrypt } from "../lib/crypto";

async function migrateTotpSecrets() {
  console.log("Starting TOTP secret re-encryption migration...");

  const result = await db.execute(
    sql`SELECT id, totp_secret FROM users WHERE totp_secret IS NOT NULL`
  );

  const rows = result.rows as Array<{ id: number; totp_secret: string }>;
  console.log(`Found ${rows.length} TOTP secrets to check.`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const reEncrypted = reEncrypt(row.totp_secret);
      if (reEncrypted) {
        await db.execute(
          sql`UPDATE users SET totp_secret = ${reEncrypted} WHERE id = ${row.id}`
        );
        migrated++;
        console.log(`  ✓ Migrated TOTP for user ID ${row.id}`);
      } else {
        skipped++;
        console.log(`  - Skipped user ID ${row.id}`);
      }
    } catch (err: any) {
      failed++;
      console.error(`  ✗ Failed user ID ${row.id}: ${err.message}`);
    }
  }

  console.log(`\nMigration complete: ${migrated} migrated, ${skipped} skipped, ${failed} failed`);
  process.exit(0);
}

migrateTotpSecrets().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
