import { pgTable, serial, text, timestamp, boolean, check, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";

export const userRoles = ["admin", "user"] as const;
export type UserRole = (typeof userRoles)[number];

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  profilePictureUrl: text("profile_picture_url"),
  theme: text("theme").default("light"),
  defaultPage: text("default_page").default("dashboard"),
  hiddenTools: jsonb("hidden_tools").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
  totpSecret: text("totp_secret"),
  totpEnabled: boolean("totp_enabled").default(false),
  totpFrequency: text("totp_frequency").default("weekly"),
  totpLastVerified: timestamp("totp_last_verified", { withTimezone: true }),
  role: text("role").default("user").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check("users_role_check", sql`${table.role} IN ('admin', 'user')`),
]);

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
