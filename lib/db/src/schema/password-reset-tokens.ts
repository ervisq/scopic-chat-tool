import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./users";

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("password_reset_tokens_token_hash_idx").on(table.tokenHash),
  index("password_reset_tokens_user_id_idx").on(table.userId),
]);

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
