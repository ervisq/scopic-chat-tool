import type { Client } from "@microsoft/microsoft-graph-client";

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

function escapeOData(value: string): string {
  return value.replace(/'/g, "''");
}

function getDateRangeFilter(query: string): string | null {
  const lower = query.toLowerCase();
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (lower.includes("today")) {
    return `receivedDateTime ge ${startOfDay.toISOString()}`;
  }

  if (lower.includes("yesterday")) {
    const yesterday = new Date(startOfDay);
    yesterday.setDate(yesterday.getDate() - 1);
    return `receivedDateTime ge ${yesterday.toISOString()} and receivedDateTime lt ${startOfDay.toISOString()}`;
  }

  if (lower.includes("this week") || lower.includes("past week") || lower.includes("last 7 days")) {
    const weekAgo = new Date(startOfDay);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return `receivedDateTime ge ${weekAgo.toISOString()}`;
  }

  if (lower.includes("last week")) {
    const dayOfWeek = now.getDay();
    const thisMonday = new Date(startOfDay);
    thisMonday.setDate(thisMonday.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(lastMonday.getDate() - 7);
    return `receivedDateTime ge ${lastMonday.toISOString()} and receivedDateTime lt ${thisMonday.toISOString()}`;
  }

  if (lower.includes("this month") || lower.includes("past month") || lower.includes("last 30 days")) {
    const monthAgo = new Date(startOfDay);
    monthAgo.setDate(monthAgo.getDate() - 30);
    return `receivedDateTime ge ${monthAgo.toISOString()}`;
  }

  if (lower.includes("last month")) {
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `receivedDateTime ge ${lastMonthStart.toISOString()} and receivedDateTime lt ${thisMonthStart.toISOString()}`;
  }

  return null;
}

function buildSearchFilter(query: string): { filter?: string; search?: string; top: number } {
  const lower = query.toLowerCase();
  const top = 20;

  const fromMatch = lower.match(/from\s+(\S+@\S+)/);
  if (fromMatch) {
    const dateFilter = getDateRangeFilter(query);
    const fromFilter = `from/emailAddress/address eq '${escapeOData(fromMatch[1])}'`;
    return { filter: dateFilter ? `${fromFilter} and ${dateFilter}` : fromFilter, top };
  }

  if (lower.includes("unread")) {
    const dateFilter = getDateRangeFilter(query);
    const unreadFilter = "isRead eq false";
    return { filter: dateFilter ? `${unreadFilter} and ${dateFilter}` : unreadFilter, top };
  }

  if (lower.includes("attachment") || lower.includes("attached")) {
    const dateFilter = getDateRangeFilter(query);
    const attachFilter = "hasAttachments eq true";
    return { filter: dateFilter ? `${attachFilter} and ${dateFilter}` : attachFilter, top };
  }

  const dateFilter = getDateRangeFilter(query);
  if (dateFilter) {
    return { filter: dateFilter, top };
  }

  const subjectMatch = lower.match(/subject[:\s]+["']?([^"']+)["']?/);
  if (subjectMatch) {
    return { search: `"subject:${escapeOData(subjectMatch[1].trim())}"`, top };
  }

  const cleanQuery = query.replace(/^(search|find|show|get|list|my|recent|latest|emails?|mail)\s*/i, "").trim();
  if (cleanQuery.length > 2) {
    return { search: `"${escapeOData(cleanQuery)}"`, top };
  }

  return { top: 15 };
}

export async function queryOutlookMail(
  client: Client,
  userEmail: string,
  query: string,
): Promise<OutlookMailResult> {
  const { filter, search, top } = buildSearchFilter(query);

  let request = client
    .api(`/users/${userEmail}/messages`)
    .top(top)
    .select("subject,from,receivedDateTime,bodyPreview,isRead,hasAttachments");

  if (filter) {
    request = request.filter(filter);
  }

  if (search) {
    request = request.search(search).header("ConsistencyLevel", "eventual");
  }

  if (!search) {
    request = request.orderby("receivedDateTime desc");
  }

  try {
    const response = await request.get();
    const messages = (response.value || []).map(mapMessage);
    return { type: "emails", messages, total: messages.length, source: "live" };
  } catch (err: any) {
    if (err?.statusCode === 400 && search) {
      const fallbackRequest = client
        .api(`/users/${userEmail}/messages`)
        .top(top)
        .select("subject,from,receivedDateTime,bodyPreview,isRead,hasAttachments")
        .orderby("receivedDateTime desc");

      if (filter) {
        fallbackRequest.filter(filter);
      }

      const fallbackResponse = await fallbackRequest.get();
      const messages = (fallbackResponse.value || []).map(mapMessage);
      return { type: "emails", messages, total: messages.length, source: "live" };
    }
    throw err;
  }
}

export function formatMailResult(result: OutlookMailResult, query: string): string {
  const q = `\n\nQuery: "${query}"`;

  if (result.messages.length === 0) return `No emails found.${q}`;

  const lines = result.messages.map((m) => {
    const date = m.receivedAt ? new Date(m.receivedAt).toLocaleString() : "Unknown date";
    const readFlag = m.isRead ? "" : " [UNREAD]";
    const attachFlag = m.hasAttachments ? " \u{1F4CE}" : "";
    return `\u2022 ${m.subject}${readFlag}${attachFlag}\n  From: ${m.from} | ${date}\n  ${m.preview}`;
  });

  return `Outlook Emails (${result.total} results):\n\n${lines.join("\n\n")}${q}`;
}
