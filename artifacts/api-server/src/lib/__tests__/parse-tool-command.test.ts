import { describe, it, expect } from "vitest";
import { parseToolCommand } from "../parse-tool-command";

describe("parseToolCommand", () => {
  describe("exact @mention detection", () => {
    it("detects @JIRA at start of message", () => {
      const result = parseToolCommand("@JIRA my open tickets");
      expect(result).not.toBeNull();
      expect(result!.tool).toBe("JIRA");
    });

    it("detects @Teamwork in the middle of a sentence", () => {
      const result = parseToolCommand("can you check my @Teamwork tasks please");
      expect(result).not.toBeNull();
      expect(result!.tool).toBe("Teamwork");
    });

    it("detects @Outlook at the end", () => {
      const result = parseToolCommand("check my emails in @Outlook");
      expect(result).not.toBeNull();
      expect(result!.tool).toBe("Outlook");
    });

    it("is case-insensitive for @mentions", () => {
      const result = parseToolCommand("@jira show bugs");
      expect(result).not.toBeNull();
      expect(result!.tool).toBe("JIRA");
    });

    it("does NOT match @tool inside email addresses", () => {
      const result = parseToolCommand("send to john@teamwork.com about the file");
      expect(result).toBeNull();
    });

    it("does NOT match @tool inside email with outlook domain", () => {
      const result = parseToolCommand("forward this to user@outlook.com please");
      expect(result).toBeNull();
    });
  });

  describe("keyword matching", () => {
    it("detects 'jira' as a standalone word", () => {
      const result = parseToolCommand("show me my jira tickets");
      expect(result).not.toBeNull();
      expect(result!.tool).toBe("JIRA");
    });

    it("detects 'teamwork' as a standalone word", () => {
      const result = parseToolCommand("what are my teamwork tasks");
      expect(result).not.toBeNull();
      expect(result!.tool).toBe("Teamwork");
    });

    it("detects 'outlook' as a standalone word", () => {
      const result = parseToolCommand("check outlook for new messages");
      expect(result).not.toBeNull();
      expect(result!.tool).toBe("Outlook");
    });

    it("detects 'sts' as a standalone word", () => {
      const result = parseToolCommand("open sts and check my hours");
      expect(result).not.toBeNull();
      expect(result!.tool).toBe("STS");
    });

    it("detects multi-word keywords like 'zoho people'", () => {
      const result = parseToolCommand("search zoho people for John");
      expect(result).not.toBeNull();
      expect(result!.tool).toBe("ZohoPeople");
    });

    it("detects 'hours logged' as STS keyword", () => {
      const result = parseToolCommand("show me hours logged today");
      expect(result).not.toBeNull();
      expect(result!.tool).toBe("STS");
    });
  });

  describe("context pattern matching", () => {
    it("detects 'tickets' as JIRA context", () => {
      const result = parseToolCommand("show me all open tickets");
      expect(result).not.toBeNull();
      expect(result!.tool).toBe("JIRA");
    });

    it("detects 'how many hours' as STS context", () => {
      const result = parseToolCommand("how many hours did I log this week");
      expect(result).not.toBeNull();
      expect(result!.tool).toBe("STS");
    });

    it("detects 'sprint' as JIRA context", () => {
      const result = parseToolCommand("what is in the current sprint");
      expect(result).not.toBeNull();
      expect(result!.tool).toBe("JIRA");
    });

    it("detects 'who is off' as ZohoPeople context", () => {
      const result = parseToolCommand("who is off today");
      expect(result).not.toBeNull();
      expect(result!.tool).toBe("ZohoPeople");
    });

    it("detects 'my tasks due' as Teamwork context", () => {
      const result = parseToolCommand("show my tasks due this week");
      expect(result).not.toBeNull();
      expect(result!.tool).toBe("Teamwork");
    });

    it("detects 'my emails' as Outlook context", () => {
      const result = parseToolCommand("show me my emails");
      expect(result).not.toBeNull();
      expect(result!.tool).toBe("Outlook");
    });
  });

  describe("no tool detection (general chat)", () => {
    it("returns null for greetings", () => {
      expect(parseToolCommand("hello, how are you?")).toBeNull();
    });

    it("returns null for general knowledge questions", () => {
      expect(parseToolCommand("what is the capital of France?")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(parseToolCommand("")).toBeNull();
    });

    it("returns null for whitespace only", () => {
      expect(parseToolCommand("   ")).toBeNull();
    });

    it("returns null for 'send a message about the meeting'", () => {
      expect(parseToolCommand("please send a message to john@teamwork.com about the meeting")).toBeNull();
    });

    it("returns null for generic sentence with 'project'", () => {
      expect(parseToolCommand("tell me about this project")).toBeNull();
    });
  });

  describe("query preservation", () => {
    it("passes the full original message as query", () => {
      const msg = "show me my jira tickets from last week";
      const result = parseToolCommand(msg);
      expect(result).not.toBeNull();
      expect(result!.query).toBe(msg);
    });

    it("passes full message even with @mention", () => {
      const msg = "can you check my @Teamwork tasks please";
      const result = parseToolCommand(msg);
      expect(result).not.toBeNull();
      expect(result!.query).toBe(msg);
    });
  });
});
