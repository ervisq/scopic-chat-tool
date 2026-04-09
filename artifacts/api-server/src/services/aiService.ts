import { openai } from "@workspace/integrations-openai-ai-server";

export interface ChatHistoryEntry {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `You are a helpful assistant embedded in a company chat application for Scopic Software. You help users interact with their integrated tools and answer general questions.

When tool data is provided, present it in a clear, helpful way based on the user's query. Format your responses nicely using plain text (no markdown).

CRITICAL: NEVER change, round, estimate, or hallucinate any numbers from the tool data. Always use the EXACT values provided. If the data says 10.0 hours, say 10.0 hours — not 10, not ~10, not "about 10." Dates, hours, counts, and all numerical values must be reproduced exactly as given in the data. Do not invent or add information not present in the data.

The system automatically detects which tool the user is referring to from natural language — users do NOT need to use @ prefixes. The system understands messages like "show me my jira tickets", "any open tasks in teamwork?", "check my emails", "how many hours did I log this week", etc.

Users can still optionally use @ prefixes (e.g. @JIRA, @Teamwork) for explicit tool selection, and these can appear anywhere in the message.

Available tools:
- JIRA — Query JIRA tickets and project data (tickets, bugs, sprints, epics, stories, backlogs)
- ZohoPeople — Query Zoho People HR data. Supports: employee list & search (full profiles with personal details, DOB, address, emergency contacts), departments, leave requests, who's off/on leave today, attendance (today/yesterday/this week/this month), timesheets, birthdays (today/this week/this month), work anniversaries, new joiners, headcount, org hierarchy/reporting structure.
- ZohoCRM — Query Zoho CRM data: leads, contacts, deals, accounts, tasks, events/meetings, calls, products, quotes, invoices, campaigns, vendors
- ZohoRecruit — Query Zoho Recruit hiring data. Supports: candidates (with skills, experience, status, employer, source), job openings (with department, positions, status, type, salary, recruiter), and interviews (with date, time, interviewers, location, candidate, job opening).
- ZohoContracts — Query Zoho Contracts data. Supports: listing contracts by status (active, expired, pending, draft, expiring soon), filtering by company or type, viewing contract details (value, dates, owner, parties).
- STS — Query STS working hours / time tracking data. Supports: hours logged this week (daily breakdown, per-project breakdown), last week's hours, time entries with project names and descriptions.
- Teamwork — Query Teamwork project management data. Supports: tasks (with assignee/due date/priority/status filtering, includes description, progress, estimates, tags, comments count), projects (with status/activity sorting, includes owner, category, task counts, tags), task lists (with completion counts), milestones (with deadlines and responsible person), time entries (with billable tracking and totals), teams (with member lists), people (with roles, phone, email, admin status), comments/discussions, tags/labels, and recent activity/changelog.
- Outlook — Query Microsoft Outlook data (read-only). Supports: emails (search inbox, recent messages, filter by sender/subject/date, unread emails, emails with attachments), calendar (today's schedule, meetings this week, upcoming events, tomorrow's meetings, next week), and contacts (search by name, list contacts, find email/phone).

If the user asks about something unrelated to the tools, answer as a helpful general assistant.

IMPORTANT: You have access to the full conversation history. Use it to understand follow-up messages. If a user's message is short or ambiguous (e.g., "teamwork", "yes", "the second one"), look at the previous messages for context to understand what they mean.`;

const TOOL_RESOLUTION_PROMPT = `You are a tool-routing assistant. Given the conversation history and the user's latest message, determine if the user is specifying or confirming which tool to use for a previous request.

Available tools: JIRA, ZohoPeople, ZohoCRM, ZohoRecruit, ZohoContracts, STS, Teamwork, Outlook

Respond with EXACTLY one of these formats:
- If the user is clearly specifying a tool: TOOL:<ToolName>|QUERY:<the full original query combining context from history>
- If the user is NOT specifying a tool: NONE

Examples:
- User previously asked "find my tickets due in April" and now says "teamwork" → TOOL:Teamwork|QUERY:find my tickets due in April
- User previously asked "show me tasks with high priority" and now says "check in jira" → TOOL:JIRA|QUERY:show me tasks with high priority
- User says "hello" with no relevant context → NONE
- User says "thanks" or "ok" → NONE`;

export async function getAIResponse(
  userMessage: string,
  toolContext?: { tool: string; query: string; data: string },
  history?: ChatHistoryEntry[],
): Promise<string> {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  if (history && history.length > 0) {
    for (const entry of history) {
      messages.push({
        role: entry.role,
        content: entry.content,
      });
    }
  }

  if (toolContext) {
    messages.push({
      role: "user",
      content: `The user said: "${userMessage}"

The system resolved this to the @${toolContext.tool} tool with the query: "${toolContext.query}"

Here is the data retrieved from ${toolContext.tool}:
${toolContext.data}

Present this data to the user in a friendly, readable way. You MUST use the EXACT numbers, dates, and values from the data above — do not change, round, estimate, or invent any values. If the total is 0, say 0.`,
    });
  } else {
    messages.push({ role: "user", content: userMessage });
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: 8192,
    temperature: toolContext ? 0.1 : 0.7,
    messages,
  });

  return response.choices[0]?.message?.content ?? "I couldn't generate a response. Please try again.";
}

export async function resolveToolFromHistory(
  userMessage: string,
  history: ChatHistoryEntry[],
): Promise<{ tool: string; query: string } | null> {
  if (!history || history.length === 0) return null;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: TOOL_RESOLUTION_PROMPT },
  ];

  for (const entry of history) {
    messages.push({ role: entry.role, content: entry.content });
  }

  messages.push({ role: "user", content: userMessage });

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: 256,
    temperature: 0,
    messages,
  });

  const result = response.choices[0]?.message?.content?.trim();
  if (!result || result === "NONE") return null;

  const toolMatch = result.match(/^TOOL:(\w+)\|QUERY:(.+)$/s);
  if (!toolMatch) return null;

  const validTools = ["JIRA", "ZohoPeople", "ZohoCRM", "ZohoRecruit", "ZohoContracts", "STS", "Teamwork", "Outlook"];
  const toolName = validTools.find(t => t.toLowerCase() === toolMatch[1].toLowerCase());
  if (!toolName) return null;

  return { tool: toolName, query: toolMatch[2].trim() };
}
