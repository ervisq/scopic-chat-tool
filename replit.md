# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Authentication**: JWT (jsonwebtoken, `JWT_SECRET` env var required) + bcryptjs for password hashing
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   │   ├── src/routes/     # API routes (health, auth, chat, credentials)
│   │   ├── src/middlewares/ # Auth middleware (JWT verification)
│   │   ├── src/services/   # Tool service layer (JIRA, Zoho, STS)
│   │   └── src/lib/        # Utilities (tool command parser, crypto, usage tracker)
│   └── client/             # React + Vite chat app (preview at /)
│       ├── src/pages/      # Dashboard, Login, Chat, Admin, Connections pages
│       ├── src/hooks/      # useAuth, useChat hooks
│       └── src/components/ # Chat UI components
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks (auto-injects JWT)
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Authentication

- Database-backed auth with bcryptjs password hashing
- Registration: `POST /api/auth/register` → creates user in DB, returns `{ token, user }`
- Login: `POST /api/auth/login` → validates credentials against DB, returns `{ token, user }`
- Get current user: `GET /api/auth/me` (protected)
- JWT payload includes `userId`, `email`, `name` with 30-day expiry
- Token auto-injected via `custom-fetch.ts` from localStorage (`auth_token` key)
- Frontend has login/register toggle, shows chat when authenticated

## STS Integration (Scopic Time System)

- Internal time tracking system at `time.scopicsoftware.com`
- REST API at `https://time.scopicsoftware.com/stsapi` with endpoints: `/time`, `/project`, `/person`
- Auth: token-based (`token[token_id]` query param), token obtained from STS URL after browser login
- Per-user credentials: each user pastes their STS token from the URL bar
- Backward compatible: accepts both `tokenId` (new) and `apiKey` (legacy) credential field names
- SSRF protection: STS API URL validated against allowlist (time.scopicsoftware.com, api-tt.scopicsoftware.com); rejects non-HTTPS and unknown hosts
- Fallback: if primary API URL fails (connection/5xx), automatically retries with api-tt.scopicsoftware.com
- Instance URL: optional, defaults to https://time.scopicsoftware.com, validated server-side
- Service (`stsService.ts`): fetches weekly time entries, calculates daily/project breakdowns, total hours
- Dashboard card: shows total hours logged this week + per-day and per-project summary
- Chat `@STS`: returns detailed time data (daily breakdown, project breakdown, individual entries)
- Supports week offset: "last week", "next week" queries
- Tool color: emerald-500, icon: ST

## Per-User Credentials

- Each employee connects their own Jira/Zoho/STS accounts via Connected Services page
- Credentials encrypted with AES-256-GCM before storage in `user_credentials` table
- Encryption key from `CREDENTIALS_ENCRYPTION_KEY` env var (required, no fallback)
- Encryption salt from `ENCRYPTION_SALT` env var (16-byte hex, required, no fallback)
- No legacy fallback: `decrypt()` uses only the current env key+salt
- All existing credentials and TOTP secrets have been re-encrypted with current key
- API: `GET /api/credentials`, `POST /api/credentials/:provider`, `DELETE /api/credentials/:provider`
- Supported providers: jira, zoho, sts, teamwork
- Tool handlers receive userId and query user's credentials from DB

## OpenAI Integration

- Uses Replit AI Integrations (no user API key required, billed to Replit credits)
- Env vars: `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY` (auto-provisioned)
- Model: `gpt-4o-mini` via `@workspace/integrations-openai-ai-server`
- AI service: `artifacts/api-server/src/services/aiService.ts`
- Flow: tool commands → fetch tool data → send to OpenAI with context → return AI response
- Non-tool messages go directly to OpenAI
- Graceful fallback: if OpenAI fails on a tool command, raw tool data is returned

## JIRA Integration

- Per-user credentials: each user connects their own Jira via Connected Services page
- Credentials stored: instance URL, email, API token (encrypted in DB)
- Service uses axios with basic auth to query Jira REST API v3
- Falls back to mock data if no credentials configured or API fails

## Zoho Integration (People + CRM)

- Automated OAuth flow: users click "Connect with Zoho" button, authorize in Zoho, redirect back
- Shared OAuth client: `ZOHO_CLIENT_ID` and `ZOHO_CLIENT_SECRET` stored as server env vars
- Per-user refresh tokens stored encrypted in DB (obtained automatically via OAuth callback)
- OAuth state uses secure random nonce (not JWT) with 10-minute TTL, stored server-side
- OAuth routes: `GET /api/zoho/auth-url` (protected), `GET /api/zoho/callback` (public with nonce validation)
- Zoho token manager (`zohoTokenManager.ts`): exchanges refresh tokens for access tokens, caches in PostgreSQL (`zoho_token_cache` table) with HMAC-SHA256 hashed cache keys and TTL-based expiry
- Domain validation: only known Zoho accounts domains are allowed (SSRF protection)
- Separate tool commands: `@ZohoPeople` for HR data, `@ZohoCRM` for sales data (no auto-routing)
- Zoho People service (`zohoPeopleService.ts`): full employee profiles (30+ fields including personal info, DOB, address, emergency contacts), search by name/email/department, birthdays (today/week/month), work anniversaries, who's off today, new joiners, headcount, org hierarchy, departments, leave requests, attendance (with date ranges), timesheets
- Employee data paginates up to 2000 records (200 per batch)
- Zoho CRM service (`zohoCrmService.ts`): leads, contacts, deals, accounts, tasks, events/meetings, calls, products, quotes, invoices, campaigns, vendors
- Record limit: 200 per query for both People and CRM

## Teamwork Integration

- Per-user credentials: API token + site URL (e.g. `https://yoursite.teamwork.com`)
- Auth: Basic auth with API token as username, `"x"` as password
- Teamwork API v3 endpoints: tasks, projects, task lists, milestones, time entries, people, teams, comments, tags, activity
- Keyword-based routing in `teamworkService.ts` maps queries to appropriate endpoint
- Task data: id, name, description, status, assignee, priority, due/start dates, progress %, estimated time, project, task list, tags, comment count, created/updated timestamps, parent task
- Task filtering: assignee name, due date ranges (today/week/month/custom), priority levels, status (active/completed/overdue), sort by latest
- Project data: id, name, description, status, company, category, dates, owner, tags, task counts, health, last updated
- Project filtering: status (active/completed), sort by recent activity
- People data: name, email, phone, company, title, role, admin status, last login
- Time entries: hours/minutes, billable flag, person, task, project, tags, totals
- Teams: member names list, project assignments
- Comments: body (HTML stripped), author, timestamp, task/project context
- Tags: name, color, project association
- Activity: recent changes log with person, type, description, timestamp
- SSRF protection: validates instanceUrl (HTTPS only, blocks private/loopback IPs)
- Error messages sanitized (no raw API error details exposed to users)
- Dashboard card shows top 5 tasks with active task count
- Tool color: purple-500, icon: TW

## Tool Command System

- Parser detects `@ToolName query` patterns in chat messages
- Router dispatches to service handlers with userId (case-insensitive matching)
- Available commands: `@JIRA`, `@ZohoPeople`, `@ZohoCRM`, `@STS`, `@Teamwork`
- Services: `jiraService.ts`, `zohoService.ts` (direct handlers), `zohoPeopleService.ts`, `zohoCrmService.ts`, `stsService.ts`, `teamworkService.ts`
- Each service checks for per-user credentials in DB
- Unknown tools return a helpful error listing available tools

## Roles & Access Control

- Three roles: `super_admin`, `admin`, `user` (stored in `users.role` column, default: `user`)
- Registration restricted to `@scopicsoftware.com` email addresses
- Super Admin (ervis.q@scopicsoftware.com): can manage all users, promote/demote between admin/user
- Admin: can view user list and usage stats (read-only)
- User: standard access, no admin panel visibility
- Middleware: `requireAdmin` (admin + super_admin), `requireSuperAdmin` (super_admin only)
- JWT payload includes `role` field
- Sidebar hides Admin link for non-admin users

## Database Schema

- `users` table: id, email, password_hash, name, phone, profile_picture_url, theme, default_page, totp_secret, totp_enabled, totp_frequency, totp_last_verified, role (super_admin/admin/user), created_at
- `zoho_token_cache` table: cache_key (HMAC-SHA256 hash, PK), access_token, expires_at, updated_at
- `user_credentials` table: id, user_id, provider, credentials_encrypted, instance_url, created_at, updated_at
- Foreign key: user_credentials.user_id → users.id (cascade delete)

## Dashboard

- Default landing page after login (replaces direct-to-chat)
- Shows service summary cards for Jira, Zoho People, Zoho CRM, STS, Teamwork
- Connected services show data previews (e.g., top 5 Jira tasks with priority/status)
- Disconnected services show "Connect" CTA buttons
- "Open App" buttons launch external tool URLs in new tabs
- "Open AI Chat" button navigates to chat page
- Backend route: `GET /api/dashboard` aggregates all service statuses for the authenticated user

## Navigation

- Persistent left sidebar (`components/sidebar.tsx`) handles all global navigation
- Nav items: Dashboard, Chat, Services (Connections), Admin, My Account
- Sidebar is collapsible (200px expanded / 60px icon-only)
- User info and Sign out at sidebar bottom
- Pages have minimal headers (title + icon only); no per-page nav buttons
- DashboardPage retains contextual action buttons (Open AI Chat, Connect service) that trigger page changes via props

## API Endpoints

- `GET /api/healthz` — health check (public)
- `POST /api/auth/register` — create account (public)
- `POST /api/auth/login` — authenticate (public, returns `requires2fa` + `tempToken` if 2FA needed)
- `POST /api/auth/verify-2fa` — verify TOTP code during 2FA login (public, requires `tempToken`)
- `GET /api/auth/me` — get current user with preferences + 2FA status (protected)
- `POST /api/chat` — send chat message (protected)
- `GET /api/admin/usage` — usage statistics (admin + super_admin)
- `GET /api/admin/users` — list all users with roles (admin + super_admin)
- `PATCH /api/admin/users/:id/role` — change user role (super_admin only, cannot set super_admin)
- `GET /api/credentials` — list connected services (protected)
- `POST /api/credentials/:provider` — save credentials (protected)
- `DELETE /api/credentials/:provider` — remove credentials (protected)
- `GET /api/dashboard` — aggregated service summaries (protected)
- `GET /api/account/profile` — get user profile (protected)
- `PUT /api/account/profile` — update profile (name, phone) (protected)
- `PUT /api/account/password` — change password (protected)
- `POST /api/account/profile-picture` — upload profile picture as base64 (protected)
- `GET /api/account/preferences` — get theme + default page (protected)
- `PUT /api/account/preferences` — update theme + default page (protected)
- `POST /api/account/2fa/setup` — generate TOTP secret + QR code (protected)
- `POST /api/account/2fa/verify` — verify TOTP code and enable 2FA (protected)
- `POST /api/account/2fa/disable` — disable 2FA (protected)
- `PUT /api/account/2fa/frequency` — set 2FA verification frequency (protected)

## My Account Page

- Three subtabs: General Information, Preferences, Security
- General: profile picture upload (base64, max 1.5MB), display name, email (read-only), phone, password change
- Preferences: theme toggle (light/dark with CSS variable swap), default landing page selector
- Security: TOTP 2FA setup with QR code, enable/disable, verification frequency (weekly/biweekly/monthly)
- Dark mode: CSS variables on `.dark` class on `<html>`, toggled via `document.documentElement.classList`
- Profile picture stored as base64 data URL in `profile_picture_url` column

## Two-Factor Authentication (2FA)

- TOTP-based using `otpauth` + `qrcode` packages
- Issuer: "WorkHub", SHA1, 6 digits, 30-second period
- TOTP secrets encrypted with AES-256-GCM (same crypto as credentials)
- Login flow: if 2FA enabled and due, returns `requires2fa: true` + short-lived `tempToken` (10min, `tokenType: 2fa_pending`)
- `tempToken` is rejected by `requireAuth` middleware — cannot access protected routes
- After TOTP verification, a full session token (`tokenType: session`, 30d) is issued
- Frequency options: every login, weekly (7d), biweekly (14d), monthly (30d)

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server with JWT auth, tool command parsing, per-user credential management, and service routing.

### `artifacts/client` (`@workspace/client`)

React + Vite chat app with login/register, Connected Services settings, admin dashboard, and ChatGPT-style chat interface.

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec and Orval codegen config. Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks. Custom fetch auto-injects JWT Bearer token from localStorage.

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas for request/response validation.

### `lib/db` (`@workspace/db`)

Drizzle ORM with PostgreSQL. Tables: users, user_credentials. Push schema: `pnpm --filter @workspace/db run push`
