import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function migrateRoles() {
  console.log("Starting role migration...");

  const colCheck = await db.execute(
    sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role'`
  );

  if (colCheck.rows.length === 0) {
    console.log("Adding role column...");
    await db.execute(sql`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`);
  } else {
    console.log("Role column already exists.");
  }

  const isAdminCheck = await db.execute(
    sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_admin'`
  );

  if (isAdminCheck.rows.length > 0) {
    console.log("Migrating is_admin data to role column...");
    await db.execute(
      sql`UPDATE users SET role = 'admin' WHERE is_admin = true AND LOWER(email) != 'ervis.q@scopicsoftware.com'`
    );
    console.log("Dropping is_admin column...");
    await db.execute(sql`ALTER TABLE users DROP COLUMN is_admin`);
    console.log("Dropped is_admin column.");
  }

  console.log("Applying role normalization + CHECK constraint atomically...");
  await db.transaction(async (tx) => {
    await tx.execute(sql`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
    await tx.execute(
      sql`UPDATE users SET role = 'user' WHERE LOWER(email) != 'ervis.q@scopicsoftware.com'`
    );
    await tx.execute(
      sql`UPDATE users SET role = 'admin' WHERE LOWER(email) = 'ervis.q@scopicsoftware.com'`
    );
    await tx.execute(
      sql`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'user'))`
    );
  });
  console.log("Role normalization + CHECK constraint applied.");

  const verification = await db.execute(
    sql`SELECT role, COUNT(*) as count FROM users GROUP BY role ORDER BY role`
  );
  console.log("\nRole distribution:");
  for (const row of verification.rows as Array<{ role: string; count: string }>) {
    console.log(`  ${row.role}: ${row.count}`);
  }

  console.log("\nMigration complete.");
  process.exit(0);
}

migrateRoles().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
