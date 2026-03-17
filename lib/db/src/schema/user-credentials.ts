import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";

export const userCredentials = pgTable("user_credentials", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  credentialsEncrypted: text("credentials_encrypted").notNull(),
  instanceUrl: text("instance_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("user_credentials_user_provider_idx").on(table.userId, table.provider),
]);

export const insertUserCredentialSchema = createInsertSchema(userCredentials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UserCredential = typeof userCredentials.$inferSelect;
export type InsertUserCredential = z.infer<typeof insertUserCredentialSchema>;
