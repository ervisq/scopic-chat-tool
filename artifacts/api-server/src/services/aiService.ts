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

IMPORTANT: Use conversation history to understand follow-up messages. If a user says "what about last month?" after asking about hours, use the same tool with updated parameters.`;

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
