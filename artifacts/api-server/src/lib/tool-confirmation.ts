const TOOL_NAMES_LOWER = new Set([
  "jira", "zohopeople", "zohocrm", "zohorecruit", "zohocontracts",
  "sts", "teamwork", "outlook",
]);

export function isLikelyToolConfirmation(message: string): boolean {
  const stripped = message.trim().replace(/[.,!?]/g, "").toLowerCase();
  const words = stripped.split(/\s+/).filter(Boolean);
  if (words.length > 4) return false;

  if (words.length <= 2 && TOOL_NAMES_LOWER.has(words.join(""))) return true;

  const prefixes = ["use", "try", "check", "in", "from", "go with", "let's use", "via"];
  for (const prefix of prefixes) {
    if (stripped.startsWith(prefix + " ")) {
      const rest = stripped.slice(prefix.length + 1).trim();
      if (TOOL_NAMES_LOWER.has(rest.replace(/\s+/g, ""))) return true;
    }
  }

  return false;
}
