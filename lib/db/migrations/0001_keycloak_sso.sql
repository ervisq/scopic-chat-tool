-- Migration: Keycloak SSO support (task #126)
--
-- Makes `users.password_hash` nullable for SSO-only accounts and adds
-- `users.keycloak_sub` with a unique constraint to link app users to the
-- Keycloak `sub` claim.
--
-- Idempotent: safe to re-run.

ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS keycloak_sub text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_keycloak_sub_unique'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_keycloak_sub_unique UNIQUE (keycloak_sub);
  END IF;
END
$$;
