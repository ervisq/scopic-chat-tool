# Overview

This project is a pnpm workspace monorepo written in TypeScript, featuring a chat application that integrates with various third-party services. The core purpose is to provide a unified interface for users to interact with tools like Jira, Zoho, STS, and Teamwork through a chat-based system, enhanced by OpenAI's AI capabilities.

The primary goal is to streamline user interaction with multiple business tools, offering a conversational interface powered by AI. This aims to improve efficiency and user experience by centralizing access and enabling intelligent data retrieval and interaction across different platforms.

Key capabilities include:
- User authentication with JWT and 2FA.
- Per-user credential management for external services, with robust encryption.
- Integration with Jira, Zoho People, Zoho CRM, Zoho Recruit, Zoho Contracts, Microsoft Outlook (Email, Calendar, Contacts), STS (Scopic Time System), and Teamwork via dedicated services.
- AI-powered chat using OpenAI, capable of understanding and executing tool commands.
- A dashboard for a quick overview of connected services and their data.
- Role-based access control for administrative functions.

# User Preferences

I prefer detailed explanations.
I want iterative development.
Do not make changes to folder `artifacts/client/src/pages/Admin`.
Do not make changes to file `lib/api-client-react/src/custom-fetch.ts`.

# System Architecture

The project is structured as a pnpm monorepo using TypeScript, Node.js 24, and pnpm as the package manager.

**Frontend:**
- Developed with React, Vite, and Tailwind CSS.
- Features a persistent left sidebar for global navigation (Dashboard, Chat, Services, Admin, My Account).
- Supports light/dark theme toggling via CSS variables.
- User profile management, preferences, and 2FA setup are handled in the "My Account" page.
- Dashboard provides an aggregated view of connected service statuses and data previews.

**Backend:**
- An Express 5 API server (`api-server`) handles all backend logic.
- **Authentication:** JWT for session management, bcryptjs for password hashing, and TOTP for 2FA. Registration is restricted to `@scopicsoftware.com` email addresses.
- **Database:** PostgreSQL with Drizzle ORM manages user data, encrypted credentials, and Zoho token cache.
- **Credential Management:** Per-user credentials for external services are encrypted with AES-256-GCM using environment variables for keys and salts.
- **API Design:** RESTful API endpoints for authentication, chat, administration, credentials, dashboard, and account management. Zod is used for schema validation.
- **Tool Command System:** Uses OpenAI function calling to route user messages to the correct tool with structured parameters. The AI selects the tool and extracts typed parameters (dates, filters, categories) from natural language. Tool schemas defined in `tool-schemas.ts`. Users can still use `@ToolName` prefixes but it's no longer required — the AI understands natural language queries like "how many hours did I log this week" directly. Zoho CRM supports AI-extracted `search_entity` for targeted searches, `owner_filter` for "my tasks"/"my deals", `include_related` to fetch related records across modules (e.g., Account → Contacts + Deals + Tasks), and date range filtering via `date_range_start`/`date_range_end`/`date_field` parameters (e.g., "deals closed last month", "tasks due this week", "leads created yesterday"). Date field defaults are module-specific when AI omits the field: Deals→Closing_Date, Tasks→Due_Date, Events/Calls→Start_DateTime, all others→Created_Time. All filter combinations work (entity+owner+date, owner+date, entity+date, etc.) with owner filter always enforced server-side. Zoho Recruit supports the same filtering pattern: `module` (candidates/job_openings/interviews/pipeline), `search_entity`, `status_filter`, `date_range_start`/`date_range_end`/`date_field` (Created_Time, Date_Opened, Target_Date, Interview_Date), and `recruiter_filter` (me/all). Recruiter filter is enforced safely (returns empty on failure). AI routing prompt includes detailed Recruit-specific guidelines with 17+ example queries. Zoho Contracts also supports structured filtering: `search_entity` (contract/company name), `status_filter` (Active/Expired/Pending/Draft/Terminated/Expiring), `owner_filter` (me/all, enforced safely — returns empty on failure), `date_range_start`/`date_range_end`/`date_field` (start_date/end_date/created_time). "Expiring" status uses 30-day lookahead on end_date. AI routing prompt includes 15+ Contracts-specific example queries.
- **AI Integration:** Utilizes Replit AI Integrations for OpenAI (`gpt-4o-mini`). Two-step flow: (1) AI routes message to the correct tool with structured params, (2) AI formats the tool results into a friendly response. Temperature 0 for routing, 0.1 for formatting to ensure consistency.
- **SSRF Protection:** Implemented for external service integrations (STS, Zoho, Teamwork) to validate instance URLs and prevent access to unauthorized hosts or private IPs.
- **Role-Based Access Control:** Three roles (`super_admin`, `admin`, `user`) control access to administrative features, defined by JWT payload and enforced by middleware.

**Core Libraries:**
- `lib/api-spec`: OpenAPI 3.1 specification for API documentation and client generation.
- `lib/api-client-react`: Generated React Query hooks with automatic JWT injection.
- `lib/api-zod`: Generated Zod schemas for validation.
- `lib/db`: Drizzle ORM configuration for PostgreSQL interaction.

# External Dependencies

- **Database:** PostgreSQL (with Drizzle ORM)
- **Authentication:** JWT (`jsonwebtoken`), bcryptjs, otpauth, qrcode
- **AI/NLP:** OpenAI (via Replit AI Integrations using `gpt-4o-mini`)
- **Third-Party Integrations:**
    - **STS (Scopic Time System):** REST API at `https://time.scopicsoftware.com/stsapi`
    - **Jira:** Jira REST API v3
    - **Zoho:** Zoho People API, Zoho CRM API, Zoho Recruit API, Zoho Contracts API (OAuth 2.0 for authentication)
    - **Microsoft Outlook:** Microsoft Graph API — Mail, Calendar, Contacts (App-level SDK with `ClientSecretCredential` + `@microsoft/microsoft-graph-client`; no per-user OAuth needed, uses `/users/{email}/` endpoints)
    - **Teamwork:** Teamwork API v3 (OAuth 2.0 via Teamwork Launchpad — requires `TEAMWORK_CLIENT_ID` and `TEAMWORK_CLIENT_SECRET` secrets; redirect URI is `https://<app-domain>/api/teamwork/callback`)
- **Build Tools:** esbuild, Vite
- **Package Management:** pnpm
- **API Client:** axios (for external service communication)
- **Validation:** Zod (`zod/v4`), `drizzle-zod`
- **API Codegen:** Orval (from OpenAPI spec)