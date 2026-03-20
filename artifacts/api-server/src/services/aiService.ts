import { openai } from "@workspace/integrations-openai-ai-server";

const SYSTEM_PROMPT = `You are a helpful assistant embedded in a chat application. You help users interact with their tools and answer general questions.

When tool data is provided, analyze and summarize it in a clear, helpful way based on the user's query. Format your responses nicely using plain text (no markdown).

Available tools users can invoke with @ commands:
- @JIRA — Query JIRA tickets and project data
- @ZohoPeople — Query Zoho People HR data (employees, leave, attendance)
- @ZohoCRM — Query Zoho CRM sales data (leads, contacts, deals, accounts)
- @STS — Query STS compliance and security data

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
