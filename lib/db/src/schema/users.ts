import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  profilePictureUrl: text("profile_picture_url"),
  theme: text("theme").default("light"),
  defaultPage: text("default_page").default("dashboard"),
  totpSecret: text("totp_secret"),
  totpEnabled: boolean("totp_enabled").default(false),
  totpFrequency: text("totp_frequency").default("weekly"),
  totpLastVerified: timestamp("totp_last_verified", { withTimezone: true }),
  role: text("role").default("user").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
