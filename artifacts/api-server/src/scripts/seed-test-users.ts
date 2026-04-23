if (process.env.NODE_ENV !== "development") {
  console.error("ERROR: seed-test-users can only run in development mode.");
  process.exit(1);
}

import { db } from "@workspace/db";
import { users } from "@workspace/db/schema";
import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { encrypt } from "../lib/crypto";
import * as OTPAuth from "otpauth";

const TEST_PASSWORD = "Scopic1234";

const testUsers = [
  { email: "ervis.q@scopicsoftware.com", name: "Ervis", role: "super_admin" },
  { email: "don@scopicsoftware.com", name: "Don", role: "user" },
  { email: "john@scopicsoftware.com", name: "John", role: "user" },
] as const;

async function seed() {
  console.log("Cleaning up old test users...");
  const keepEmails = testUsers.map((u) => u.email);
  await db.execute(
    sql`DELETE FROM users WHERE email NOT IN (${sql.join(keepEmails.map((e) => sql`${e}`), sql`, `)})`
  );
  console.log("Deleted old users.");

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  for (const u of testUsers) {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, u.email))
      .limit(1);

    const secret = new OTPAuth.Secret({ size: 20 });
    const encryptedSecret = encrypt(secret.base32);

    if (existing) {
      await db
        .update(users)
        .set({
          name: u.name,
          role: u.role,
          passwordHash,
          totpEnabled: true,
          totpSecret: encryptedSecret,
          totpFrequency: "always",
          totpLastVerified: null,
        })
        .where(eq(users.id, existing.id));
      console.log(`Updated ${u.email} -> ${u.role}`);
    } else {
      await db.insert(users).values({
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash,
        totpEnabled: true,
        totpSecret: encryptedSecret,
        totpFrequency: "always",
        totpLastVerified: null,
      });
      console.log(`Created ${u.email} -> ${u.role}`);
    }
  }

  const result = await db.execute(
    sql`SELECT id, email, name, role, totp_enabled FROM users ORDER BY id`
  );
  console.log("\nFinal users:");
  for (const row of result.rows as Array<{ id: number; email: string; name: string; role: string; totp_enabled: boolean }>) {
    console.log(`  ${row.id}: ${row.email} (${row.name}) — ${row.role}, 2FA: ${row.totp_enabled}`);
  }

  console.log(`\nAll passwords: ${TEST_PASSWORD}`);
  console.log("2FA code (dev mode): 000000");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
