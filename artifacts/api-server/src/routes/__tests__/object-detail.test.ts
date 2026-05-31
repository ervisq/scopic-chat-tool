import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-do-not-use-in-prod";

// object-detail.ts -> auth middleware imports the db at module load; stub it so
// no real database connection is attempted during the route tests.
vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
  },
}));

vi.mock("@workspace/db/schema", () => ({
  users: { id: "id", role: "role", tokenVersion: "tokenVersion" },
}));

// Capture every Graph SDK path the (real) getEmailDetail would request so we can
// assert that opaque message ids are encoded into a single path segment and can
// never traverse into another Graph resource.
let graphConfigured = true;
let fakeApiPaths: string[] = [];
const fakeMessage = {
  id: "msg-1",
  subject: "Hello",
  from: { emailAddress: { name: "Alice", address: "alice@scopicsoftware.com" } },
  toRecipients: [],
  ccRecipients: [],
  receivedDateTime: "2026-05-31T00:00:00Z",
  isRead: true,
  hasAttachments: false,
  body: { contentType: "text", content: "hi" },
};

function makeFakeGraphClient() {
  const builder = {
    select() {
      return builder;
    },
    get: async () => fakeMessage,
  };
  return {
    api(path: string) {
      fakeApiPaths.push(path);
      return builder;
    },
  };
}

vi.mock("../../services/microsoftGraphClient", () => ({
  isGraphConfigured: () => graphConfigured,
  getGraphClient: () => makeFakeGraphClient(),
}));

const getTeamworkTaskDetail = vi.fn();
vi.mock("../../services/teamworkService", () => ({
  getTeamworkTaskDetail: (...args: unknown[]) => getTeamworkTaskDetail(...args),
}));

let currentUser: { userId: number; email: string; name: string };

let app: Express;
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  vi.resetModules();
  const { default: objectDetailRouter } = await import("../object-detail");
  app = express();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as unknown as { user: typeof currentUser }).user = currentUser;
    next();
  });
  app.use("/api", objectDetailRouter);
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
  graphConfigured = true;
  fakeApiPaths = [];
  currentUser = { userId: 1, email: "user@scopicsoftware.com", name: "User" };
});

async function getJson(path: string) {
  const res = await fetch(`${baseUrl}${path}`);
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body: json };
}

describe("GET /api/details/outlook/email", () => {
  it("returns the email detail for a valid id and requests an encoded single path segment", async () => {
    const { status } = await getJson(`/api/details/outlook/email?id=${encodeURIComponent("msg-1")}`);
    expect(status).toBe(200);
    expect(fakeApiPaths.length).toBeGreaterThan(0);
    expect(fakeApiPaths[0]).toBe("/users/user%40scopicsoftware.com/messages/msg-1");
  });

  it("encodes ids containing reserved characters (slash, plus, equals) into one segment", async () => {
    const rawId = "AAMk/segment+with=reserved";
    const { status } = await getJson(`/api/details/outlook/email?id=${encodeURIComponent(rawId)}`);
    expect(status).toBe(200);
    const requested = fakeApiPaths[0];
    // The id must occupy exactly one path segment after .../messages/ — the raw
    // "/" must be percent-encoded, never used as a separator.
    expect(requested).toBe(`/users/user%40scopicsoftware.com/messages/${encodeURIComponent(rawId)}`);
    const afterMessages = requested.split("/messages/")[1];
    expect(afterMessages).not.toContain("/");
  });

  it("rejects traversal payloads with 400 and never issues a Graph request", async () => {
    const { status, body } = await getJson(`/api/details/outlook/email?id=${encodeURIComponent("../..")}`);
    expect(status).toBe(400);
    expect(body.message).toBe("Invalid email id");
    expect(fakeApiPaths.length).toBe(0);
  });

  it("rejects ids that embed a parent-directory token even with extra characters", async () => {
    const { status } = await getJson(`/api/details/outlook/email?id=${encodeURIComponent("foo/../../bar")}`);
    expect(status).toBe(400);
    expect(fakeApiPaths.length).toBe(0);
  });

  it("rejects ids containing control characters with 400", async () => {
    const { status } = await getJson(`/api/details/outlook/email?id=${encodeURIComponent("bad\u0000id")}`);
    expect(status).toBe(400);
    expect(fakeApiPaths.length).toBe(0);
  });

  it("rejects implausibly long ids with 400", async () => {
    const longId = "a".repeat(1001);
    const { status } = await getJson(`/api/details/outlook/email?id=${encodeURIComponent(longId)}`);
    expect(status).toBe(400);
    expect(fakeApiPaths.length).toBe(0);
  });

  it("returns 400 when the id is missing", async () => {
    const { status, body } = await getJson(`/api/details/outlook/email`);
    expect(status).toBe(400);
    expect(body.message).toBe("Missing email id");
    expect(fakeApiPaths.length).toBe(0);
  });

  it("returns 409 when Microsoft Graph is not configured", async () => {
    graphConfigured = false;
    const { status } = await getJson(`/api/details/outlook/email?id=msg-1`);
    expect(status).toBe(409);
    expect(fakeApiPaths.length).toBe(0);
  });

  it("returns 409 when the user has no email address", async () => {
    currentUser = { userId: 1, email: "", name: "User" };
    const { status } = await getJson(`/api/details/outlook/email?id=msg-1`);
    expect(status).toBe(409);
    expect(fakeApiPaths.length).toBe(0);
  });
});

describe("GET /api/details/teamwork/task/:id", () => {
  it("returns the task detail for a valid numeric id", async () => {
    const detail = { task: { id: 42 }, comments: [], instanceUrl: "https://x.teamwork.com" };
    getTeamworkTaskDetail.mockResolvedValueOnce({ source: "live", detail });
    const { status, body } = await getJson(`/api/details/teamwork/task/42`);
    expect(status).toBe(200);
    expect(body).toEqual(detail);
    expect(getTeamworkTaskDetail).toHaveBeenCalledWith(1, 42);
  });

  it("rejects a non-numeric id with 400 and never calls the service", async () => {
    const { status, body } = await getJson(`/api/details/teamwork/task/abc`);
    expect(status).toBe(400);
    expect(body.message).toBe("Invalid task id");
    expect(getTeamworkTaskDetail).not.toHaveBeenCalled();
  });

  it("rejects a zero id with 400", async () => {
    const { status } = await getJson(`/api/details/teamwork/task/0`);
    expect(status).toBe(400);
    expect(getTeamworkTaskDetail).not.toHaveBeenCalled();
  });

  it("rejects a negative id with 400", async () => {
    const { status } = await getJson(`/api/details/teamwork/task/-5`);
    expect(status).toBe(400);
    expect(getTeamworkTaskDetail).not.toHaveBeenCalled();
  });

  it("rejects a non-integer id with 400", async () => {
    const { status } = await getJson(`/api/details/teamwork/task/1.5`);
    expect(status).toBe(400);
    expect(getTeamworkTaskDetail).not.toHaveBeenCalled();
  });

  it("returns 409 when Teamwork is not connected", async () => {
    getTeamworkTaskDetail.mockResolvedValueOnce({ source: "not_connected" });
    const { status, body } = await getJson(`/api/details/teamwork/task/42`);
    expect(status).toBe(409);
    expect(body.message).toBe("Your Teamwork account is not connected.");
  });

  it("returns 502 when the service reports an error", async () => {
    getTeamworkTaskDetail.mockResolvedValueOnce({ source: "error", message: "Task not found" });
    const { status, body } = await getJson(`/api/details/teamwork/task/42`);
    expect(status).toBe(502);
    expect(body.message).toBe("Task not found");
  });
});
