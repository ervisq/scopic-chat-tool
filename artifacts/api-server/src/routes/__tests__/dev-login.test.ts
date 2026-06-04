import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import express, { type Express } from "express";
import jwt from "jsonwebtoken";
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-do-not-use-in-prod";

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
    email: "ervis.q@scopicsoftware.com",
    name: "ervis.q",
    role: "admin",
    tokenVersion: 0,
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
  sendPasswordChangedNotice: vi.fn(),
  getPasswordResetMailerStatus: () => ({ ok: false, reason: "test mock" }),
}));

async function buildApp(nodeEnv: string): Promise<{ server: Server; baseUrl: string }> {
  process.env.NODE_ENV = nodeEnv;
  vi.resetModules();
  const { default: authRouter } = await import("../auth");
  const app: Express = express();
  app.use(express.json());
  app.use("/api", authRouter);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${addr.port}` };
}

async function postJson(baseUrl: string, path: string, body: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body: json };
}

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

beforeEach(() => {
  selectResults.length = 0;
  insertReturning.mockClear();
});

afterAll(() => {
  process.env.NODE_ENV = ORIGINAL_NODE_ENV;
});

describe("POST /api/auth/dev-login when NODE_ENV=development", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    ({ server, baseUrl } = await buildApp("development"));
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("returns a valid session token for a @scopicsoftware.com email", async () => {
    selectResults.push([]); // user lookup -> not found, will provision
    const { status, body } = await postJson(baseUrl, "/api/auth/dev-login", {
      email: "ervis.q@scopicsoftware.com",
    });

    expect(status).toBe(200);
    expect(typeof body.token).toBe("string");

    const decoded = jwt.verify(
      body.token as string,
      process.env.JWT_SECRET!,
    ) as Record<string, unknown>;
    expect(decoded.email).toBe("ervis.q@scopicsoftware.com");
    expect(decoded.tokenType).toBe("session");
    expect(decoded.userId).toBe(1);

    const user = body.user as Record<string, unknown>;
    expect(user.email).toBe("ervis.q@scopicsoftware.com");
  });

  it("rejects a non-@scopicsoftware.com email with 400", async () => {
    const { status, body } = await postJson(baseUrl, "/api/auth/dev-login", {
      email: "intruder@example.com",
    });

    expect(status).toBe(400);
    expect(body.message).toContain("@scopicsoftware.com");
    expect(insertReturning).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/dev-login when NODE_ENV=production (published app)", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    ({ server, baseUrl } = await buildApp("production"));
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("refuses with 404 even for a valid @scopicsoftware.com email", async () => {
    const { status, body } = await postJson(baseUrl, "/api/auth/dev-login", {
      email: "ervis.q@scopicsoftware.com",
    });

    expect(status).toBe(404);
    expect(body.token).toBeUndefined();
    expect(insertReturning).not.toHaveBeenCalled();
  });
});
