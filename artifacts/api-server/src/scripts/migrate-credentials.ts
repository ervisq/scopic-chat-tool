import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { reEncrypt } from "../lib/crypto";

async function migrateCredentials() {
  console.log("Starting credential re-encryption migration...");

  const result = await db.execute(
    sql`SELECT id, credentials_encrypted FROM user_credentials`
  );

  const rows = result.rows as Array<{ id: number; credentials_encrypted: string }>;
  console.log(`Found ${rows.length} credential records to check.`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const reEncrypted = reEncrypt(row.credentials_encrypted);
      if (reEncrypted) {
        await db.execute(
          sql`UPDATE user_credentials SET credentials_encrypted = ${reEncrypted} WHERE id = ${row.id}`
        );
        migrated++;
        console.log(`  ✓ Migrated credential ID ${row.id}`);
      } else {
        skipped++;
        console.log(`  - Skipped credential ID ${row.id} (already using new key or failed)`);
      }
    } catch (err: any) {
      failed++;
      console.error(`  ✗ Failed credential ID ${row.id}: ${err.message}`);
    }
  }

  console.log(`\nMigration complete: ${migrated} migrated, ${skipped} skipped, ${failed} failed`);
  process.exit(0);
}

migrateCredentials().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
