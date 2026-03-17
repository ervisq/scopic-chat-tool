# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Authentication**: JWT (jsonwebtoken)
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
│   │   ├── src/routes/     # API routes (health, auth, chat)
│   │   ├── src/middlewares/ # Auth middleware (JWT verification)
│   │   ├── src/services/   # Tool service layer (JIRA, Zoho, STS)
│   │   └── src/lib/        # Utilities (tool command parser)
│   └── client/             # React + Vite chat app (preview at /)
│       ├── src/pages/      # Login page, Chat page
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

- JWT-based auth with `jsonwebtoken`
- Mock user: `admin@scopic.com` / `123456`
- Login: `POST /api/auth/login` → returns `{ token, user }`
- Get current user: `GET /api/auth/me` (protected)
- Chat route (`POST /api/chat`) is protected by `requireAuth` middleware
- Token auto-injected via `custom-fetch.ts` from localStorage (`auth_token` key)
- Frontend shows login page when unauthenticated, chat page when authenticated

## Tool Command System

- Parser detects `@ToolName query` patterns in chat messages
- Router dispatches to service handlers (case-insensitive matching)
- Services: `jiraService.ts`, `zohoService.ts`, `stsService.ts`
- Each service has typed interfaces, async query function, and format function
- Unknown tools return a helpful error listing available tools

## API Endpoints

- `GET /api/healthz` — health check (public)
- `POST /api/auth/login` — authenticate (public)
- `GET /api/auth/me` — get current user (protected)
- `POST /api/chat` — send chat message (protected)

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server with JWT auth, tool command parsing, and service routing.

### `artifacts/client` (`@workspace/client`)

React + Vite chat app with login page, auth state management, and ChatGPT-style chat interface.

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec and Orval codegen config. Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks. Custom fetch auto-injects JWT Bearer token from localStorage.

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas for request/response validation.

### `lib/db` (`@workspace/db`)

Drizzle ORM with PostgreSQL (not yet used for data persistence).
