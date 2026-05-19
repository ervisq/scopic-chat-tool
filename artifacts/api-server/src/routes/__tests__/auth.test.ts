import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import express, { type Express } from "express";
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-do-not-use-in-prod";
delete process.env.BREAK_GLASS_PASSWORD_LOGIN;

vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    insert: () => ({ values: () => ({ returning: async () => [] }) }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
  },
}));

vi.mock("@workspace/db/schema", () => ({
  users: { email: "email", id: "id" },
  passwordResetTokens: {
    id: "id",
    userId: "userId",
    tokenHash: "tokenHash",
    expiresAt: "expiresAt",
    usedAt: "usedAt",
  },
}));

vi.mock("../../services/passwordResetMailer", () => ({
  sendPasswordResetEmail: vi.fn(),
  getPasswordResetMailerStatus: () => ({ ok: false, reason: "test mock" }),
}));

let app: Express;
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  vi.resetModules();
  const { default: authRouter } = await import("../auth");
  app = express();
  app.use(express.json());
  app.use("/api", authRouter);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  vi.clearAllMocks();
});

async function postJson(path: string, body: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body: json };
}

describe("password routes when BREAK_GLASS_PASSWORD_LOGIN is unset (SSO-only mode)", () => {
  it("POST /api/auth/register returns 404", async () => {
    const { status } = await postJson("/api/auth/register", {
      email: "alice@scopicsoftware.com",
      password: "longenough",
      name: "Alice",
    });
    expect(status).toBe(404);
  });

  it("POST /api/auth/login returns 404", async () => {
    const { status } = await postJson("/api/auth/login", {
      email: "alice@scopicsoftware.com",
      password: "longenough",
    });
    expect(status).toBe(404);
  });

  it("POST /api/auth/verify-2fa returns 404", async () => {
    const { status } = await postJson("/api/auth/verify-2fa", { token: "abc", code: "000000" });
    expect(status).toBe(404);
  });

  it("POST /api/auth/forgot-password returns 404", async () => {
    const { status } = await postJson("/api/auth/forgot-password", { email: "a@scopicsoftware.com" });
    expect(status).toBe(404);
  });

  it("POST /api/auth/reset-password returns 404", async () => {
    const { status } = await postJson("/api/auth/reset-password", { token: "x", newPassword: "longenough" });
    expect(status).toBe(404);
  });
});
