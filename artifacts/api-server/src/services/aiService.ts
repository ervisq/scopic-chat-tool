import { openai } from "@workspace/integrations-openai-ai-server";
import { TOOL_DEFINITIONS, TOOL_NAME_MAP } from "../lib/tool-schemas";

export interface ChatHistoryEntry {
  role: "user" | "assistant";
  content: string;
}

export interface ToolCallResult {
  toolName: string;
  functionName: string;
  args: Record<string, unknown>;
}

const ROUTING_SYSTEM_PROMPT = `You are a tool-routing assistant for Scopic Software's internal chat application. Today's date is __TODAY__.

Your job is to determine if the user's message requires calling one of the available tools, and if so, extract the correct parameters.

When resolving dates, use YYYY-MM-DD format. Week starts on Monday:
- "this week" = Monday of current week to Sunday of current week
- "last week" = Monday of PREVIOUS week to Sunday of PREVIOUS week (NOT the last 7 days)
- "this month" = 1st day to last day of current month
- "last month" = 1st day to last day of previous month  
- "today" = today's date for both start and end
- "yesterday" = yesterday's date for both start and end
- "last N days" = (today minus N-1 days) to today
- "March 2026" = 2026-03-01 to 2026-03-31
- For any named month without a year, assume the most recent occurrence

Example: If today is 2026-04-10 (Thursday):
- "this week" → 2026-04-06 (Mon) to 2026-04-12 (Sun)
- "last week" → 2026-03-30 (Mon) to 2026-04-05 (Sun)

If the user's message is general conversation (greetings, thanks, general questions) that doesn't require any tool, do NOT call any function.

IMPORTANT: Use conversation history to understand follow-up messages. If a user says "what about last month?" after asking about hours, use the same tool with updated parameters.

Zoho CRM search_entity guidelines:
- When the user mentions a specific company, person, or entity name, ALWAYS extract it into search_entity. This is critical for targeted searches. Examples:
  - "Portfolio Co contact person" → search_entity: "Portfolio Co", module: "contacts"
  - "Nailed Technologies" → search_entity: "Nailed Technologies", module: "accounts", include_related: true
  - "Nailed Technologies tasks" → search_entity: "Nailed Technologies", module: "tasks"
  - "deals for Acme Corp" → search_entity: "Acme Corp", module: "deals"
  - "everything about John Smith" → search_entity: "John Smith", include_related: true
  - "all leads" → no search_entity (generic listing)
  - "my tasks" → owner_filter: "me", module: "tasks"
- If the query is JUST a company/person name (e.g. "Nailed Technologies"), set search_entity to that name, module to "accounts", and include_related to true.
- Do NOT include generic words like "contact", "person", "website", "details", "activity" in search_entity — only the actual entity/proper noun name.
- When the user mentions a name without specifying a module, default module to "accounts" and set include_related: true.

Zoho CRM date filtering guidelines:
- When the user mentions dates, time periods, or relative time references, extract date_range_start and date_range_end in YYYY-MM-DD format.
- Resolve relative dates the same way as STS. Today is the current date. Week starts Monday.
  - "yesterday" → previous day for both start and end
  - "today" → today's date for both start and end
  - "this week" → Monday to Sunday of current week
  - "last week" → Monday to Sunday of previous week
  - "last two weeks" → 14 days ago to today
  - "this month" → first day to last day of current month
  - "last month" → first day to last day of previous month
  - "last 3 months" → first day of 3 months ago to today
  - "this year" → January 1 to today
  - "since March" or "from March" → March 1 to today
  - "before April" → January 1 of current year to March 31
- Pick the right date_field based on module and context:
  - deals: "Closing_Date" (for "closed", "closing") or "Created_Time" (for "created", "added")
  - tasks: "Due_Date" (for "due") or "Created_Time" (for "created")
  - events/calls: "Start_DateTime"
  - leads/contacts/accounts: "Created_Time"
  - If unclear, default to "Created_Time"
- Examples:
  - "deals closed last month" → module: "deals", date_field: "Closing_Date", date_range_start/end: last month range
  - "tasks due this week" → module: "tasks", date_field: "Due_Date", date_range_start/end: this week range
  - "leads created yesterday" → module: "leads", date_field: "Created_Time", date_range_start/end: yesterday
  - "my tasks due this week" → module: "tasks", owner_filter: "me", date_field: "Due_Date", date_range_start/end: this week
  - "Portfolio Co deals this year" → search_entity: "Portfolio Co", module: "deals", date_field: "Closing_Date", date_range_start/end: this year range
  - "contacts from January to March" → module: "contacts", date_field: "Created_Time", date_range_start: Jan 1, date_range_end: Mar 31`;

const RESPONSE_SYSTEM_PROMPT = `You are a helpful assistant embedded in a company chat application for Scopic Software. You help users interact with their integrated tools and answer general questions.

When tool data is provided, present it in a clear, helpful way based on the user's query. Format your responses nicely using plain text (no markdown).

CRITICAL: NEVER change, round, estimate, or hallucinate any numbers from the tool data. Always use the EXACT values provided. If the data says 10.0 hours, say 10.0 hours — not 10, not ~10, not "about 10." Dates, hours, counts, and all numerical values must be reproduced exactly as given in the data. Do not invent or add information not present in the data.

IMPORTANT: When the tool data contains URLs (starting with https://), you MUST preserve them EXACTLY as-is in your response. Place each URL on the same line as or directly after the item it belongs to. Never modify, shorten, omit, or reformat URLs. They are used to create clickable links in the chat UI.

If the user asks about something unrelated to tools, answer as a helpful general assistant.`;

export async function routeWithAI(
  userMessage: string,
  history?: ChatHistoryEntry[],
): Promise<ToolCallResult | null> {
  const todayStr = new Date().toISOString().split("T")[0];
  const systemPrompt = ROUTING_SYSTEM_PROMPT.replace("__TODAY__", todayStr);
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  if (history && history.length > 0) {
    for (const entry of history) {
      messages.push({ role: entry.role, content: entry.content });
    }
  }

  messages.push({ role: "user", content: userMessage });

  console.log("[AI Router] Sending message to OpenAI for tool routing...");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    max_completion_tokens: 512,
    messages,
    tools: TOOL_DEFINITIONS,
    tool_choice: "auto",
  });

  const choice = response.choices[0];
  const toolCalls = choice?.message?.tool_calls;

  if (!toolCalls || toolCalls.length === 0) {
    console.log("[AI Router] No tool call — general conversation");
    return null;
  }

  const tc = toolCalls[0];
  const functionName = tc.function.name;
  const displayName = TOOL_NAME_MAP[functionName] || functionName;
  let args: Record<string, unknown> = {};

  try {
    args = JSON.parse(tc.function.arguments);
  } catch {
    console.error("[AI Router] Failed to parse tool arguments:", tc.function.arguments);
  }

  console.log("[AI Router] Tool selected:", displayName, "args:", JSON.stringify(args));

  return {
    toolName: displayName,
    functionName,
    args,
  };
}

export async function formatToolResponse(
  userMessage: string,
  toolName: string,
  toolData: string,
  history?: ChatHistoryEntry[],
): Promise<string> {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: RESPONSE_SYSTEM_PROMPT },
  ];

  if (history && history.length > 0) {
    for (const entry of history) {
      messages.push({ role: entry.role, content: entry.content });
    }
  }

  messages.push({
    role: "user",
    content: `The user said: "${userMessage}"

Here is the data retrieved from ${toolName}:
${toolData}

Present this data to the user in a friendly, readable way. You MUST use the EXACT numbers, dates, and values from the data above — do not change, round, estimate, or invent any values. If the total is 0, say 0.`,
  });

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: 8192,
    temperature: 0.1,
    messages,
  });

  return response.choices[0]?.message?.content ?? "I couldn't generate a response. Please try again.";
}

export async function getGeneralResponse(
  userMessage: string,
  history?: ChatHistoryEntry[],
): Promise<string> {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: RESPONSE_SYSTEM_PROMPT },
  ];

  if (history && history.length > 0) {
    for (const entry of history) {
      messages.push({ role: entry.role, content: entry.content });
    }
  }

  messages.push({ role: "user", content: userMessage });

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: 8192,
    temperature: 0.7,
    messages,
  });

  return response.choices[0]?.message?.content ?? "I couldn't generate a response. Please try again.";
}
