import { openai } from "@workspace/integrations-openai-ai-server";

const SYSTEM_PROMPT = `You are a helpful assistant embedded in a chat application. You help users interact with their tools and answer general questions.

When tool data is provided, analyze and summarize it in a clear, helpful way based on the user's query. Format your responses nicely using plain text (no markdown).

Available tools users can invoke with @ commands:
- @JIRA — Query JIRA tickets and project data
- @ZohoPeople — Query Zoho People HR data. Supports: employee list & search (full profiles with personal details, DOB, address, emergency contacts), departments, leave requests, who's off/on leave today, attendance (today/yesterday/this week/this month), timesheets, birthdays (today/this week/this month), work anniversaries, new joiners, headcount, org hierarchy/reporting structure. Users can ask things like "who has a birthday today", "who is off today", "find John", "John's email", "how many employees", "new hires this month", etc.
- @ZohoCRM — Query Zoho CRM data: leads, contacts, deals, accounts, tasks, events/meetings, calls, products, quotes, invoices, campaigns, vendors
- @STS — Query STS working hours / time tracking data. Supports: hours logged this week (daily breakdown, per-project breakdown), last week's hours, time entries with project names and descriptions. Users can ask things like "my hours this week", "how many hours did I log", "hours by project", "last week hours", etc.
- @Teamwork — Query Teamwork project management data. Supports: tasks (with assignee/due date/priority/status filtering, includes description, progress, estimates, tags, comments count), projects (with status/activity sorting, includes owner, category, task counts, tags), task lists (with completion counts), milestones (with deadlines and responsible person), time entries (with billable tracking and totals), teams (with member lists), people (with roles, phone, email, admin status), comments/discussions, tags/labels, and recent activity/changelog. Users can ask things like "my tasks due this week", "tasks assigned to John", "high priority tasks", "project updates", "time logged today", "who is on the team", "recent activity", "task comments", etc.

If the user asks about something unrelated to the tools, answer as a helpful general assistant.`;

export async function getAIResponse(
  userMessage: string,
  toolContext?: { tool: string; query: string; data: string },
): Promise<string> {
  const messages: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  if (toolContext) {
    messages.push({
      role: "user",
      content: `The user used the @${toolContext.tool} tool with the query: "${toolContext.query}"

Here is the data retrieved from ${toolContext.tool}:
${toolContext.data}

Please analyze this data and provide a helpful response to the user's query.`,
    });
  } else {
    messages.push({ role: "user", content: userMessage });
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: 8192,
    messages,
  });

  return response.choices[0]?.message?.content ?? "I couldn't generate a response. Please try again.";
}
