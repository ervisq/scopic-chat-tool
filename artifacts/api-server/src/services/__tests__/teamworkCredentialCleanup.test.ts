import { describe, it, expect, vi, beforeEach } from "vitest";

const selectRows = vi.fn();
const deleteWhere = vi.fn(async () => ({ rowCount: 0 }));

vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: async () => selectRows(),
      }),
    }),
    delete: () => ({
      where: (...args: unknown[]) => deleteWhere(...args),
    }),
  },
}));

vi.mock("@workspace/db/schema", () => ({
  userCredentials: {
    id: "id",
    provider: "provider",
    credentialsEncrypted: "credentials_encrypted",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: (a: unknown, b: unknown) => ({ eq: [a, b] }),
  inArray: (a: unknown, b: unknown) => ({ inArray: [a, b] }),
  sql: (s: TemplateStringsArray) => s.join(""),
}));

const decryptMock = vi.fn((s: string) => s);
vi.mock("../../lib/crypto", () => ({
  decrypt: (s: string) => decryptMock(s),
}));

async function runCleanup() {
  vi.resetModules();
  const mod = await import("../teamworkCredentialCleanup");
  return mod.cleanupOrphanedTeamworkCredentials();
}

beforeEach(() => {
  selectRows.mockReset();
  deleteWhere.mockReset();
  deleteWhere.mockResolvedValue({ rowCount: 0 });
  decryptMock.mockReset();
  decryptMock.mockImplementation((s: string) => s);
});

describe("cleanupOrphanedTeamworkCredentials", () => {
  it("keeps OAuth rows with a non-empty refreshToken", async () => {
    selectRows.mockResolvedValueOnce([
      { id: 1, credentialsEncrypted: JSON.stringify({ refreshToken: "rt-abc" }) },
    ]);

    const removed = await runCleanup();

    expect(removed).toBe(0);
    expect(deleteWhere).not.toHaveBeenCalled();
  });

  it("deletes legacy { apiToken } rows that lack a refreshToken", async () => {
    selectRows.mockResolvedValueOnce([
      { id: 7, credentialsEncrypted: JSON.stringify({ apiToken: "legacy-token" }) },
      { id: 8, credentialsEncrypted: JSON.stringify({ refreshToken: "" }) },
      { id: 9, credentialsEncrypted: JSON.stringify({ refreshToken: "rt-keep" }) },
    ]);
    deleteWhere.mockResolvedValueOnce({ rowCount: 2 });

    const removed = await runCleanup();

    expect(removed).toBe(2);
    expect(deleteWhere).toHaveBeenCalledTimes(1);
    const arg = deleteWhere.mock.calls[0][0] as { inArray: [unknown, number[]] };
    expect(arg.inArray[1].sort()).toEqual([7, 8]);
  });

  it("does NOT delete rows whose ciphertext cannot be decrypted/parsed", async () => {
    selectRows.mockResolvedValueOnce([
      { id: 42, credentialsEncrypted: "garbage" },
      { id: 43, credentialsEncrypted: JSON.stringify({ refreshToken: "rt-keep" }) },
    ]);
    decryptMock.mockImplementation((s: string) => {
      if (s === "garbage") throw new Error("bad ciphertext");
      return s;
    });

    const removed = await runCleanup();

    expect(removed).toBe(0);
    expect(deleteWhere).not.toHaveBeenCalled();
  });

  it("is a no-op when there are no Teamwork rows", async () => {
    selectRows.mockResolvedValueOnce([]);

    const removed = await runCleanup();

    expect(removed).toBe(0);
    expect(deleteWhere).not.toHaveBeenCalled();
  });
});
