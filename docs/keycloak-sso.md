# Keycloak SSO

This app uses **Keycloak SSO only** for sign-in. Password login is disabled by default.

## Identity provider

- Realm: `ScopicSoftware` at `https://auth.scopicsoftware.com`
- Client ID: `scopic-chat-app`
- Client type: confidential, standard flow (authorization code) + PKCE (S256)
- Required scopes: `openid profile email`

## Redirect URIs registered with IT

| Environment | URI |
|-------------|-----|
| Production  | `https://exercise-wip.replit.app/api/auth/keycloak/callback` |
| Development | `https://<replit-dev-domain>/api/auth/keycloak/callback`     |

## Environment variables

| Name | Required | Notes |
|------|----------|-------|
| `KEYCLOAK_ISSUER_URL`     | yes | e.g. `https://auth.scopicsoftware.com/realms/ScopicSoftware` |
| `KEYCLOAK_CLIENT_ID`      | yes | `scopic-chat-app` |
| `KEYCLOAK_CLIENT_SECRET`  | yes | Confidential client secret. Rotate if leaked. |
| `JWT_SECRET`              | yes | Already used by the app; also signs the short-lived OIDC state cookie. |
| `BREAK_GLASS_PASSWORD_LOGIN` | no | Set to `true` to re-enable the legacy password routes (`/api/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-2fa`). Off by default. |

## How the flow works

1. User visits `/login` and clicks **Sign in with Scopic SSO**.
2. Browser navigates to `GET /api/auth/keycloak/login`.
   - Server generates PKCE `code_verifier`, `state`, `nonce`.
   - All three are packed into a short-lived (10 min) signed (JWT) cookie `kc_oidc_state` scoped to `/api/auth/keycloak`.
   - Server 302-redirects to Keycloak's authorization endpoint.
3. User signs in (and completes MFA) on `auth.scopicsoftware.com`.
4. Keycloak redirects back to `/api/auth/keycloak/callback?code=…&state=…`.
   - Server verifies the cookie, checks `state`, exchanges the code (with PKCE), and verifies the ID token (`iss`, `aud`, `nonce`, signature).
   - Rejects the sign-in if `email_verified !== true` or the email doesn't end in `@scopicsoftware.com`.
   - Looks up the user by lowercased email:
     - If not found: inserts a new row with `password_hash = NULL`, `keycloak_sub = <sub>`, and `role = "user"` (or `"admin"` for the admin email).
     - If found: updates `keycloak_sub` and `name` if changed; preserves an existing admin role.
   - Signs the app's own session JWT with the existing `signToken(...)` and redirects to `/auth/sso-callback#token=<jwt>`.
5. The tiny `/auth/sso-callback` page reads the token from the hash, stores it in `localStorage`, and replaces the URL with `/`.
6. `useAuth` picks up the new token, calls `/api/auth/me`, and the app is signed in.

## Admin

`ervis.q@scopicsoftware.com` keeps `role = "admin"`. On first SSO sign-in:
- If the row already exists with `role = "admin"`, it is preserved.
- If the row doesn't exist yet, it is created with `role = "admin"`.

## Troubleshooting

- **`?error=email_not_verified`** — the Keycloak user hasn't verified their email yet. Have the user verify it in Keycloak.
- **`?error=wrong_domain`** — the token's email isn't `@scopicsoftware.com`. Either the wrong account was used, or IT mapped a non-Scopic email — check the client's email mapper.
- **`?error=sso_state_missing` / `sso_state_invalid`** — the OIDC state cookie was lost or expired. The user took longer than 10 minutes between clicking sign-in and finishing on Keycloak. Just retry.
- **`?error=sso_missing_claims`** — the ID token didn't include `sub` or `email`. Check the Keycloak client's mappers: `sub`, `email`, `email_verified`, and `name` (or `given_name`/`family_name`) are required.
- **`?error=sso_unavailable`** — server couldn't reach the Keycloak discovery document. Check network/firewall and `KEYCLOAK_ISSUER_URL`.
- **Clock skew** — `openid-client` allows ~60s of skew by default. If the server clock is wildly off, ID token verification will fail with a `jwt expired` / `jwt issued in the future` error.

## Break-glass: emergency password login

If Keycloak is down and the admin needs to sign in:

1. Set `BREAK_GLASS_PASSWORD_LOGIN=true` in the API server environment.
2. Restart the API server.
3. The legacy `/api/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, and `/auth/verify-2fa` routes become available again.
4. There is **no UI** for this — call the API directly (e.g. with `curl`) or re-enable the password form in `login-page.tsx` temporarily.
5. Unset the flag and restart once Keycloak is back.

## Database

Schema change (already applied):

```sql
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN keycloak_sub text;
ALTER TABLE users ADD CONSTRAINT users_keycloak_sub_unique UNIQUE (keycloak_sub);
```

SSO-only users have `password_hash = NULL`. Existing password users keep their hash so they can still sign in via break-glass.

## Rolling back to password-only

1. Set `BREAK_GLASS_PASSWORD_LOGIN=true`.
2. Restore the previous version of `artifacts/client/src/pages/login-page.tsx` (or temporarily render the password form alongside the SSO button).
3. Optionally remove the `keycloak_sub` column — not required; it's nullable.
