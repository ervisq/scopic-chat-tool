import { describe, it, expect } from "vitest";
import { isLikelyToolConfirmation } from "../tool-confirmation";

describe("isLikelyToolConfirmation", () => {
  it("detects bare tool names", () => {
    expect(isLikelyToolConfirmation("teamwork")).toBe(true);
    expect(isLikelyToolConfirmation("jira")).toBe(true);
    expect(isLikelyToolConfirmation("JIRA")).toBe(true);
    expect(isLikelyToolConfirmation("outlook")).toBe(true);
    expect(isLikelyToolConfirmation("sts")).toBe(true);
    expect(isLikelyToolConfirmation("ZohoPeople")).toBe(true);
    expect(isLikelyToolConfirmation("ZohoCRM")).toBe(true);
    expect(isLikelyToolConfirmation("ZohoRecruit")).toBe(true);
    expect(isLikelyToolConfirmation("ZohoContracts")).toBe(true);
  });

  it("detects tool names with punctuation", () => {
    expect(isLikelyToolConfirmation("teamwork.")).toBe(true);
    expect(isLikelyToolConfirmation("jira!")).toBe(true);
    expect(isLikelyToolConfirmation("outlook?")).toBe(true);
  });

  it("detects 'use/try/check + tool' patterns", () => {
    expect(isLikelyToolConfirmation("use teamwork")).toBe(true);
    expect(isLikelyToolConfirmation("try jira")).toBe(true);
    expect(isLikelyToolConfirmation("check outlook")).toBe(true);
    expect(isLikelyToolConfirmation("in jira")).toBe(true);
    expect(isLikelyToolConfirmation("from zohocrm")).toBe(true);
    expect(isLikelyToolConfirmation("via sts")).toBe(true);
  });

  it("detects multi-word prefixes", () => {
    expect(isLikelyToolConfirmation("go with teamwork")).toBe(true);
    expect(isLikelyToolConfirmation("let's use jira")).toBe(true);
  });

  it("detects Zoho tools with spaces", () => {
    expect(isLikelyToolConfirmation("use zoho people")).toBe(true);
    expect(isLikelyToolConfirmation("zoho crm")).toBe(true);
  });

  it("rejects long messages (full queries, not confirmations)", () => {
    expect(isLikelyToolConfirmation("show me my teamwork tasks with high priority")).toBe(false);
    expect(isLikelyToolConfirmation("find my jira tickets that are overdue")).toBe(false);
    expect(isLikelyToolConfirmation("check my outlook emails from this week")).toBe(false);
  });

  it("rejects non-tool messages", () => {
    expect(isLikelyToolConfirmation("hello")).toBe(false);
    expect(isLikelyToolConfirmation("thanks")).toBe(false);
    expect(isLikelyToolConfirmation("yes")).toBe(false);
    expect(isLikelyToolConfirmation("no")).toBe(false);
    expect(isLikelyToolConfirmation("what do you think?")).toBe(false);
  });

  it("rejects empty input", () => {
    expect(isLikelyToolConfirmation("")).toBe(false);
    expect(isLikelyToolConfirmation("   ")).toBe(false);
  });
});
