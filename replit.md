# Overview

This project is a pnpm workspace monorepo written in TypeScript, featuring a chat application that integrates with various third-party services. The core purpose is to provide a unified interface for users to interact with tools like Jira, Zoho, STS, and Teamwork through a chat-based system, enhanced by OpenAI's AI capabilities.

The primary goal is to streamline user interaction with multiple business tools, offering a conversational interface powered by AI. This aims to improve efficiency and user experience by centralizing access and enabling intelligent data retrieval and interaction across different platforms.

Key capabilities include:
- User authentication with JWT and 2FA.
- Per-user credential management for external services, with robust encryption.
- Integration with Jira, Zoho People, Zoho CRM, STS (Scopic Time System), and Teamwork via dedicated services.
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
- **Tool Command System:** A parser detects `@ToolName query` patterns in chat messages, routing them to specific service handlers (e.g., Jira, Zoho, STS, Teamwork).
- **AI Integration:** Utilizes Replit AI Integrations for OpenAI (`gpt-4o-mini`), allowing natural language interaction with integrated tools. Non-tool messages are also processed by OpenAI.
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
    - **Zoho:** Zoho People API, Zoho CRM API (OAuth 2.0 for authentication)
    - **Teamwork:** Teamwork API v3
- **Build Tools:** esbuild, Vite
- **Package Management:** pnpm
- **API Client:** axios (for external service communication)
- **Validation:** Zod (`zod/v4`), `drizzle-zod`
- **API Codegen:** Orval (from OpenAPI spec)