export interface ToolCommand {
  tool: string;
  query: string;
}

export function parseToolCommand(message: string): ToolCommand | null {
  const trimmed = message.trim();
  const match = trimmed.match(/^@([a-zA-Z0-9_-]+)\s+(.+)/s);
  if (!match) return null;

  const query = match[2].trim();
  if (!query) return null;

  return {
    tool: match[1],
    query,
  };
}
