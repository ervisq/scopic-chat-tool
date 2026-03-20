# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Authentication**: JWT (jsonwebtoken) + bcryptjs for password hashing
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
│       ├── src/pages/      # Login, Chat, Admin, Connections pages
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

## Per-User Credentials

- Each employee connects their own Jira/Zoho/STS accounts via Connected Services page
- Credentials encrypted with AES-256-GCM before storage in `user_credentials` table
- Encryption key from `CREDENTIALS_ENCRYPTION_KEY` env var (falls back to JWT_SECRET)
- API: `GET /api/credentials`, `POST /api/credentials/:provider`, `DELETE /api/credentials/:provider`
- Supported providers: jira, zoho, sts
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
- Zoho token manager (`zohoTokenManager.ts`): exchanges refresh tokens for access tokens, caches in memory with TTL
- Domain validation: only known Zoho accounts domains are allowed (SSRF protection)
- Separate tool commands: `@ZohoPeople` for HR data, `@ZohoCRM` for sales data (no auto-routing)
- Zoho People service (`zohoPeopleService.ts`): employees, leave requests, attendance
- Zoho CRM service (`zohoCrmService.ts`): leads, contacts, deals, accounts

## Tool Command System

- Parser detects `@ToolName query` patterns in chat messages
- Router dispatches to service handlers with userId (case-insensitive matching)
- Available commands: `@JIRA`, `@ZohoPeople`, `@ZohoCRM`, `@STS`
- Services: `jiraService.ts`, `zohoService.ts` (direct handlers), `zohoPeopleService.ts`, `zohoCrmService.ts`, `stsService.ts`
- Each service checks for per-user credentials in DB
- Unknown tools return a helpful error listing available tools

## Database Schema

- `users` table: id, email, password_hash, name, created_at
- `user_credentials` table: id, user_id, provider, credentials_encrypted, instance_url, created_at, updated_at
- Foreign key: user_credentials.user_id → users.id (cascade delete)

## API Endpoints

- `GET /api/healthz` — health check (public)
- `POST /api/auth/register` — create account (public)
- `POST /api/auth/login` — authenticate (public)
- `GET /api/auth/me` — get current user (protected)
- `POST /api/chat` — send chat message (protected)
- `GET /api/usage` — usage statistics (protected)
- `GET /api/credentials` — list connected services (protected)
- `POST /api/credentials/:provider` — save credentials (protected)
- `DELETE /api/credentials/:provider` — remove credentials (protected)

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
