import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import express, { type Express } from "express";
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-do-not-use-in-prod";
process.env.BREAK_GLASS_PASSWORD_LOGIN = "true";

type SelectChain = {
  from: () => SelectChain;
  where: () => SelectChain;
  limit: (n: number) => Promise<unknown[]>;
};

const selectResults: unknown[][] = [];

function makeSelectChain(): SelectChain {
  const chain: SelectChain = {
    from: () => chain,
    where: () => chain,
    limit: async () => {
      if (selectResults.length === 0) return [];
      return selectResults.shift() as unknown[];
    },
  };
  return chain;
}

const insertReturning = vi.fn(async () => [
  {
    id: 1,
    email: "newuser@scopicsoftware.com",
    name: "New User",
    role: "user",
    phone: null,
    profilePictureUrl: null,
    theme: "light",
    defaultPage: "dashboard",
    totpEnabled: false,
  },
]);

vi.mock("@workspace/db", () => ({
  db: {
    select: () => makeSelectChain(),
    insert: () => ({ values: () => ({ returning: insertReturning }) }),
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
  delete process.env.BREAK_GLASS_PASSWORD_LOGIN;
});

beforeEach(() => {
  selectResults.length = 0;
  insertReturning.mockClear();
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

describe("BREAK_GLASS_PASSWORD_LOGIN=true — POST /api/auth/register 4xx branches", () => {
  it("400 + field hint when required fields are missing", async () => {
    const { status, body } = await postJson("/api/auth/register", {
      email: "",
      password: "",
      name: "",
    });
    expect(status).toBe(400);
    expect(body.message).toBe("Email, password, and name are required");
    expect(body.field).toBe("email");
  });

  it("400 + field=email when domain is not @scopicsoftware.com", async () => {
    const { status, body } = await postJson("/api/auth/register", {
      email: "alice@example.com",
      password: "longenough",
      name: "Alice",
    });
    expect(status).toBe(400);
    expect(body.message).toBe(
      "Only @scopicsoftware.com email addresses are allowed to register",
    );
    expect(body.field).toBe("email");
  });

  it("400 + field=password when password is too short", async () => {
    const { status, body } = await postJson("/api/auth/register", {
      email: "bob@scopicsoftware.com",
      password: "abc",
      name: "Bob",
    });
    expect(status).toBe(400);
    expect(body.message).toBe("Password must be at least 6 characters");
    expect(body.field).toBe("password");
  });

  it("409 + field=email when an account with that email already exists", async () => {
    selectResults.push([{ id: 99, email: "carol@scopicsoftware.com" }]);
    const { status, body } = await postJson("/api/auth/register", {
      email: "carol@scopicsoftware.com",
      password: "longenough",
      name: "Carol",
    });
    expect(status).toBe(409);
    expect(body.message).toBe(
      "An account with this email already exists. Try signing in instead.",
    );
    expect(body.field).toBe("email");
  });
});

describe("BREAK_GLASS_PASSWORD_LOGIN=true — POST /api/auth/login 400 branch", () => {
  it("400 when the request body fails LoginBody validation", async () => {
    const { status, body } = await postJson("/api/auth/login", {
      email: "x@scopicsoftware.com",
    });
    expect(status).toBe(400);
    expect(body.message).toBe("Email and password are required");
    expect(body.field).toBeUndefined();
  });
});
