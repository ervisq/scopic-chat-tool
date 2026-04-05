export interface ToolCommand {
  tool: string;
  query: string;
}

const TOOL_NAMES = [
  "JIRA",
  "ZohoPeople",
  "ZohoCRM",
  "ZohoRecruit",
  "ZohoContracts",
  "STS",
  "Teamwork",
  "Outlook",
];

const KEYWORD_MAP: { keywords: string[]; tool: string }[] = [
  { keywords: ["jira ticket", "jira issue", "jira board", "jira sprint", "jira backlog", "jira bug", "jira project"], tool: "JIRA" },
  { keywords: ["zoho people", "zohopeople", "employee list", "leave request", "who is off", "who's off", "work anniversary", "new joiner", "headcount", "department list", "org hierarchy"], tool: "ZohoPeople" },
  { keywords: ["zoho crm", "zohocrm", "sales pipeline"], tool: "ZohoCRM" },
  { keywords: ["zoho recruit", "zohorecruit", "job opening", "job position", "interview schedule"], tool: "ZohoRecruit" },
  { keywords: ["zoho contracts", "zohocontracts", "contract status", "active contracts", "expiring contracts", "draft contracts"], tool: "ZohoContracts" },
  { keywords: ["time tracking", "hours logged", "hours this week", "hours today", "weekly hours", "last week hours", "hours by project", "how many hours", "time entry", "time entries", "work hours"], tool: "STS" },
  { keywords: ["teamwork task", "teamwork project"], tool: "Teamwork" },
  { keywords: ["outlook email", "outlook calendar", "unread email", "recent email", "emails from", "my inbox", "check inbox", "tomorrow's meetings", "next week meetings", "meetings today", "schedule this week", "upcoming meetings", "calendar events", "my schedule"], tool: "Outlook" },
];

const KEYWORD_WORD_BOUNDARY: { pattern: RegExp; tool: string }[] = [
  { pattern: /\bjira\b/i, tool: "JIRA" },
  { pattern: /\bzoho\s+people\b/i, tool: "ZohoPeople" },
  { pattern: /\bzoho\s*crm\b/i, tool: "ZohoCRM" },
  { pattern: /\bzoho\s+recruit\b/i, tool: "ZohoRecruit" },
  { pattern: /\bzoho\s+contracts?\b/i, tool: "ZohoContracts" },
  { pattern: /\bsts\b/i, tool: "STS" },
  { pattern: /\bteamwork\b/i, tool: "Teamwork" },
  { pattern: /\boutlook\b/i, tool: "Outlook" },
];

const CONTEXT_KEYWORDS: { patterns: RegExp[]; tool: string }[] = [
  { patterns: [/\b(?:ticket|bug|sprint|backlog|epic|story)s?\b/i], tool: "JIRA" },
  { patterns: [/\b(?:employee|day off|absent|pto|sick leave)s?\b/i, /\bwho(?:'s| is) (?:off|absent|on leave)\b/i, /\bbirthday\b/i, /\battendance\b/i, /\btimesheet\b/i, /\bleave\s+(?:request|balance|status)\b/i], tool: "ZohoPeople" },
  { patterns: [/\b(?:leads?|deals?|pipeline|prospect|opportunity)\b/i], tool: "ZohoCRM" },
  { patterns: [/\b(?:candidates?|applicants?)\b/i, /\bjob\s+(?:opening|position)s?\b/i], tool: "ZohoRecruit" },
  { patterns: [/\bcontracts?\b.*\b(?:active|expired?|expiring|pending|draft|renewal)\b/i, /\b(?:active|expired?|expiring|pending|draft)\b.*\bcontracts?\b/i], tool: "ZohoContracts" },
  { patterns: [/\bhours?\s+(?:logged|tracked|worked|this week|today|last week)\b/i, /\bhow many hours\b/i, /\btime\s+(?:log|track|entry|entries|sheet)\b/i], tool: "STS" },
  { patterns: [/\b(?:my\s+)?tasks?\b.*\b(?:due|assigned|priority|open|completed|overdue)\b/i, /\b(?:due|assigned|open|overdue)\b.*\btasks?\b/i, /\bmilestones?\b/i], tool: "Teamwork" },
  { patterns: [/\b(?:my\s+)?(?:emails?|e-mails?|inbox)\b/i, /\b(?:unread|recent|check)\s+(?:emails?|messages?)\b/i, /\b(?:my\s+)?(?:meetings?|calendar|schedule)\s+(?:today|this week|tomorrow|next week)\b/i, /\b(?:today'?s?|tomorrow'?s?|upcoming)\s+(?:meetings?|schedule|appointments?)\b/i], tool: "Outlook" },
];

function stripEmails(text: string): string {
  return text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, " ");
}

function tryExactAtMatch(message: string): ToolCommand | null {
  const cleaned = stripEmails(message);
  const atPattern = /(?:^|[\s,;!?(])@([a-zA-Z0-9_-]+)\b/g;
  let match: RegExpExecArray | null;
  while ((match = atPattern.exec(cleaned)) !== null) {
    const mentioned = match[1];
    const resolved = TOOL_NAMES.find(
      (t) => t.toLowerCase() === mentioned.toLowerCase(),
    );
    if (resolved) {
      return { tool: resolved, query: message };
    }
  }
  return null;
}

function tryKeywordMatch(message: string): ToolCommand | null {
  const cleaned = stripEmails(message);
  const lower = cleaned.toLowerCase();

  for (const entry of KEYWORD_MAP) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) {
        return { tool: entry.tool, query: message };
      }
    }
  }

  for (const entry of KEYWORD_WORD_BOUNDARY) {
    if (entry.pattern.test(cleaned)) {
      return { tool: entry.tool, query: message };
    }
  }

  return null;
}

function tryContextMatch(message: string): ToolCommand | null {
  const cleaned = stripEmails(message);
  for (const entry of CONTEXT_KEYWORDS) {
    for (const pat of entry.patterns) {
      if (pat.test(cleaned)) {
        return { tool: entry.tool, query: message };
      }
    }
  }
  return null;
}

export function parseToolCommand(message: string): ToolCommand | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  return tryExactAtMatch(trimmed)
    ?? tryKeywordMatch(trimmed)
    ?? tryContextMatch(trimmed);
}
