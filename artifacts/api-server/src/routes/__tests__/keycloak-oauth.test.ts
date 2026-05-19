import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-do-not-use-in-prod";
process.env.REPLIT_DEV_DOMAIN = "test.replit.dev";

const STATE_COOKIE = "kc_oidc_state";
const VALID_STATE = "state-abc";
const VALID_NONCE = "nonce-xyz";
const VALID_VERIFIER = "verifier-123";

type MockClaims = Record<string, unknown>;

const claimsRef: { current: MockClaims } = {
  current: {
    sub: "kc-sub-1",
    email: "newuser@scopicsoftware.com",
    email_verified: true,
    name: "New User",
  },
};

vi.mock("../../lib/keycloak", () => {
  return {
    getKeycloakClient: async () => ({
      authorizationUrl: () => "https://keycloak.example/auth",
      callbackParams: () => ({ code: "code-1", state: VALID_STATE }),
      callback: async () => ({ claims: () => claimsRef.current }),
    }),
    generators: {
      state: () => VALID_STATE,
      nonce: () => VALID_NONCE,
      codeVerifier: () => VALID_VERIFIER,
      codeChallenge: () => "challenge",
    },
  };
});

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
    limit: async () => (selectResults.length === 0 ? [] : (selectResults.shift() as unknown[])),
  };
  return chain;
}

const insertReturning = vi.fn();
const updateReturning = vi.fn();
const insertValues = vi.fn(() => ({ returning: insertReturning }));
const updateSet = vi.fn(() => ({ where: () => ({ returning: updateReturning }) }));

vi.mock("@workspace/db", () => ({
  db: {
    select: () => makeSelectChain(),
    insert: () => ({ values: insertValues }),
    update: () => ({ set: updateSet }),
  },
}));

vi.mock("@workspace/db/schema", () => ({
  users: { email: "email", id: "id" },
}));

let app: Express;
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  vi.resetModules();
  const { default: keycloakRouter } = await import("../keycloak-oauth");
  app = express();
  app.use(cookieParser());
  app.use("/api", keycloakRouter);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  selectResults.length = 0;
  insertReturning.mockReset();
  updateReturning.mockReset();
  insertValues.mockClear();
  updateSet.mockClear();
  claimsRef.current = {
    sub: "kc-sub-1",
    email: "newuser@scopicsoftware.com",
    email_verified: true,
    name: "New User",
  };
});

function signValidStateCookie(): string {
  return jwt.sign(
    { state: VALID_STATE, codeVerifier: VALID_VERIFIER, nonce: VALID_NONCE },
    process.env.JWT_SECRET!,
    { expiresIn: 600 },
  );
}

async function callCallback(opts: { cookie?: string } = {}) {
  const headers: Record<string, string> = {};
  if (opts.cookie !== undefined) {
    headers["Cookie"] = `${STATE_COOKIE}=${opts.cookie}`;
  }
  return fetch(`${baseUrl}/api/auth/keycloak/callback?code=code-1&state=${VALID_STATE}`, {
    method: "GET",
    redirect: "manual",
    headers,
  });
}

describe("GET /api/auth/keycloak/callback", () => {
  it("happy path: provisions new user and redirects with token", async () => {
    selectResults.push([]); // user lookup -> not found
    insertReturning.mockResolvedValueOnce([
      {
        id: 42,
        email: "newuser@scopicsoftware.com",
        name: "New User",
        role: "user",
        tokenVersion: 0,
        keycloakSub: "kc-sub-1",
      },
    ]);

    const res = await callCallback({ cookie: signValidStateCookie() });

    expect(res.status).toBe(302);
    const loc = res.headers.get("location") || "";
    expect(loc).toContain("/auth/sso-callback#token=");
    expect(insertValues).toHaveBeenCalledTimes(1);
    const insertedRow = insertValues.mock.calls[0][0] as Record<string, unknown>;
    expect(insertedRow.email).toBe("newuser@scopicsoftware.com");
    expect(insertedRow.passwordHash).toBeNull();
    expect(insertedRow.keycloakSub).toBe("kc-sub-1");
    expect(insertedRow.role).toBe("user");
  });

  it("happy path: provisions admin email with role=admin", async () => {
    claimsRef.current = {
      sub: "kc-sub-admin",
      email: "ervis.q@scopicsoftware.com",
      email_verified: true,
      name: "Ervis Q",
    };
    selectResults.push([]);
    insertReturning.mockResolvedValueOnce([
      {
        id: 1,
        email: "ervis.q@scopicsoftware.com",
        name: "Ervis Q",
        role: "admin",
        tokenVersion: 0,
        keycloakSub: "kc-sub-admin",
      },
    ]);

    const res = await callCallback({ cookie: signValidStateCookie() });
    expect(res.status).toBe(302);
    const insertedRow = insertValues.mock.calls[0][0] as Record<string, unknown>;
    expect(insertedRow.role).toBe("admin");
  });

  it("preserves existing admin role on returning login", async () => {
    selectResults.push([
      {
        id: 7,
        email: "ervis.q@scopicsoftware.com",
        name: "Ervis Q",
        role: "admin",
        tokenVersion: 3,
        keycloakSub: null,
      },
    ]);
    claimsRef.current = {
      sub: "kc-sub-admin",
      email: "ervis.q@scopicsoftware.com",
      email_verified: true,
      name: "Ervis Q",
    };
    updateReturning.mockResolvedValueOnce([
      {
        id: 7,
        email: "ervis.q@scopicsoftware.com",
        name: "Ervis Q",
        role: "admin",
        tokenVersion: 3,
        keycloakSub: "kc-sub-admin",
      },
    ]);

    const res = await callCallback({ cookie: signValidStateCookie() });
    expect(res.status).toBe(302);
    expect(insertValues).not.toHaveBeenCalled();
    const update = updateSet.mock.calls[0][0] as Record<string, unknown>;
    expect(update.keycloakSub).toBe("kc-sub-admin");
    // role should NOT be downgraded; setter only includes role when promoting
    expect(update.role === undefined || update.role === "admin").toBe(true);
  });

  it("redirects with sso_state_missing when cookie absent", async () => {
    const res = await callCallback({});
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("error=sso_state_missing");
  });

  it("redirects with sso_state_invalid when cookie is malformed/expired", async () => {
    const res = await callCallback({ cookie: "not-a-valid-jwt" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("error=sso_state_invalid");
  });

  it("redirects with wrong_domain when email is not @scopicsoftware.com", async () => {
    claimsRef.current = {
      sub: "kc-sub-2",
      email: "intruder@example.com",
      email_verified: true,
      name: "Intruder",
    };
    const res = await callCallback({ cookie: signValidStateCookie() });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("error=wrong_domain");
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("redirects with email_not_verified when token has email_verified=false", async () => {
    claimsRef.current = {
      sub: "kc-sub-3",
      email: "unverified@scopicsoftware.com",
      email_verified: false,
      name: "Unverified",
    };
    const res = await callCallback({ cookie: signValidStateCookie() });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("error=email_not_verified");
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("redirects with sso_missing_claims when sub or email is missing", async () => {
    claimsRef.current = { email: "noSub@scopicsoftware.com", email_verified: true };
    const res = await callCallback({ cookie: signValidStateCookie() });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("error=sso_missing_claims");
  });
});
