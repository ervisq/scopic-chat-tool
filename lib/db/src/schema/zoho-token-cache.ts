import { pgTable, text, bigint, timestamp } from "drizzle-orm/pg-core";

export const zohoTokenCache = pgTable("zoho_token_cache", {
  cacheKey: text("cache_key").primaryKey(),
  accessToken: text("access_token").notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
