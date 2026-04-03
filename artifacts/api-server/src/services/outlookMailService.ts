import axios from "axios";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

interface MailMessage {
  subject: string;
  from: string;
  receivedAt: string;
  preview: string;
  isRead: boolean;
  hasAttachments: boolean;
}

interface OutlookMailResult {
  type: "emails";
  messages: MailMessage[];
  total: number;
  source: "live";
}

function mapMessage(m: any): MailMessage {
  return {
    subject: m.subject || "(No Subject)",
    from: m.from?.emailAddress?.name
      ? `${m.from.emailAddress.name} <${m.from.emailAddress.address}>`
      : m.from?.emailAddress?.address || "Unknown",
    receivedAt: m.receivedDateTime || "",
    preview: (m.bodyPreview || "").slice(0, 200),
    isRead: !!m.isRead,
    hasAttachments: !!m.hasAttachments,
  };
}

function buildSearchFilter(query: string): { filter?: string; search?: string; top: number } {
  const lower = query.toLowerCase();
  const top = 20;

  const fromMatch = lower.match(/from\s+(\S+@\S+)/);
  if (fromMatch) {
    return { filter: `from/emailAddress/address eq '${fromMatch[1]}'`, top };
  }

  const subjectMatch = lower.match(/subject[:\s]+["']?([^"']+)["']?/);
  if (subjectMatch) {
    return { search: `"subject:${subjectMatch[1].trim()}"`, top };
  }

  if (lower.includes("unread")) {
    return { filter: "isRead eq false", top };
  }

  if (lower.includes("attachment") || lower.includes("attached")) {
    return { filter: "hasAttachments eq true", top };
  }

  const todayStr = new Date().toISOString().split("T")[0];
  if (lower.includes("today")) {
    return { filter: `receivedDateTime ge ${todayStr}T00:00:00Z`, top };
  }

  const cleanQuery = query.replace(/^(search|find|show|get|list|my|recent|latest)\s*/i, "").trim();
  if (cleanQuery.length > 2) {
    return { search: `"${cleanQuery}"`, top };
  }

  return { top: 15 };
}

export async function queryOutlookMail(
  accessToken: string,
  query: string,
): Promise<OutlookMailResult> {
  const { filter, search, top } = buildSearchFilter(query);

  const params: Record<string, string> = {
    $top: String(top),
    $orderby: "receivedDateTime desc",
    $select: "subject,from,receivedDateTime,bodyPreview,isRead,hasAttachments",
  };

  if (filter) params.$filter = filter;
  if (search) params.$search = search;

  const url = `${GRAPH_BASE}/me/messages`;
  const response = await axios.get(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params,
  });

  const messages = (response.data.value || []).map(mapMessage);
  return { type: "emails", messages, total: messages.length, source: "live" };
}

export function formatMailResult(result: OutlookMailResult, query: string): string {
  const q = `\n\nQuery: "${query}"`;

  if (result.messages.length === 0) return `No emails found.${q}`;

  const lines = result.messages.map((m) => {
    const date = m.receivedAt ? new Date(m.receivedAt).toLocaleString() : "Unknown date";
    const readFlag = m.isRead ? "" : " [UNREAD]";
    const attachFlag = m.hasAttachments ? " 📎" : "";
    return `• ${m.subject}${readFlag}${attachFlag}\n  From: ${m.from} | ${date}\n  ${m.preview}`;
  });

  return `Outlook Emails (${result.total} results):\n\n${lines.join("\n\n")}${q}`;
}
