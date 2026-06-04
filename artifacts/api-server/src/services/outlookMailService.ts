import type { Client } from "@microsoft/microsoft-graph-client";

export interface MailMessage {
  id: string;
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
    id: m.id || "",
    subject: m.subject || "(No Subject)",
    from: m.from?.emailAddress?.name
      ? `${m.from.emailAddress.name} <${m.from.emailAddress.address}>`
      : m.from?.emailAddress?.address || "Unknown",
    receivedAt: m.receivedDateTime || "",
    preview: (m.bodyPreview || "").slice(0, 120),
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
    .select("id,subject,from,receivedDateTime,bodyPreview,isRead,hasAttachments");

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
        .select("id,subject,from,receivedDateTime,bodyPreview,isRead,hasAttachments")
        .orderby("receivedDateTime desc");

      const finalRequest = filter ? fallbackRequest.filter(filter) : fallbackRequest;

      const fallbackResponse = await finalRequest.get();
      const messages = (fallbackResponse.value || []).map(mapMessage);
      return { type: "emails", messages, total: messages.length, source: "live" };
    }
    throw err;
  }
}

export async function getRecentEmails(
  client: Client,
  userEmail: string,
  count: number = 5,
): Promise<MailMessage[]> {
  const response = await client
    .api(`/users/${userEmail}/messages`)
    .top(count)
    .select("id,subject,from,receivedDateTime,bodyPreview,isRead,hasAttachments")
    .orderby("receivedDateTime desc")
    .get();
  return (response.value || []).map(mapMessage);
}

export interface MailAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  isInline: boolean;
}

export interface MailDetail {
  id: string;
  subject: string;
  from: string;
  to: string[];
  cc: string[];
  receivedAt: string;
  isRead: boolean;
  hasAttachments: boolean;
  bodyContentType: "html" | "text";
  bodyContent: string;
  attachments: MailAttachment[];
}

function formatRecipients(arr: any[]): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((r) => {
      const name = r?.emailAddress?.name;
      const address = r?.emailAddress?.address;
      if (name && address) return `${name} <${address}>`;
      return address || name || "";
    })
    .filter(Boolean);
}

export async function getEmailDetail(client: Client, userEmail: string, messageId: string): Promise<MailDetail> {
  // Graph message IDs are opaque and may contain reserved characters (e.g. "/",
  // "+", "="). Encode them as a single path segment so they can never alter the
  // request path or traverse into other Graph resources.
  const encodedUser = encodeURIComponent(userEmail);
  const encodedId = encodeURIComponent(messageId);

  const m = await client
    .api(`/users/${encodedUser}/messages/${encodedId}`)
    .select("id,subject,from,toRecipients,ccRecipients,receivedDateTime,isRead,hasAttachments,body")
    .get();

  let attachments: MailAttachment[] = [];
  if (m.hasAttachments) {
    try {
      const attRes = await client
        .api(`/users/${encodedUser}/messages/${encodedId}/attachments`)
        .select("id,name,contentType,size,isInline")
        .get();
      attachments = (attRes?.value || [])
        .filter((a: any) => !a.isInline)
        .map((a: any) => ({
          id: a.id || "",
          name: a.name || "(unnamed)",
          contentType: a.contentType || "",
          size: typeof a.size === "number" ? a.size : 0,
          isInline: !!a.isInline,
        }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Outlook] Failed to load attachments:", msg);
    }
  }

  const bodyContentType: "html" | "text" = m.body?.contentType === "html" ? "html" : "text";

  return {
    id: m.id || messageId,
    subject: m.subject || "(No Subject)",
    from: m.from?.emailAddress?.name
      ? `${m.from.emailAddress.name} <${m.from.emailAddress.address}>`
      : m.from?.emailAddress?.address || "Unknown",
    to: formatRecipients(m.toRecipients),
    cc: formatRecipients(m.ccRecipients),
    receivedAt: m.receivedDateTime || "",
    isRead: !!m.isRead,
    hasAttachments: !!m.hasAttachments,
    bodyContentType,
    bodyContent: m.body?.content || "",
    attachments,
  };
}

export async function markEmailRead(
  client: Client,
  userEmail: string,
  messageId: string,
): Promise<void> {
  // Graph message IDs are opaque and may contain reserved characters; encode
  // them as a single path segment so they can never alter the request path.
  const encodedUser = encodeURIComponent(userEmail);
  const encodedId = encodeURIComponent(messageId);
  await client
    .api(`/users/${encodedUser}/messages/${encodedId}`)
    .update({ isRead: true });
}

export function formatMailResult(result: OutlookMailResult, query: string): string {
  const q = `\n\nQuery: "${query}"`;

  if (result.messages.length === 0) return `No emails found.${q}`;

  const lines = result.messages.map((m) => {
    const date = m.receivedAt ? new Date(m.receivedAt).toLocaleString() : "Unknown date";
    const readFlag = m.isRead ? "" : " [UNREAD]";
    const attachFlag = m.hasAttachments ? " \u{1F4CE}" : "";
    const link = m.id ? ` https://outlook.office.com/mail/inbox/id/${encodeURIComponent(m.id)}` : "";
    return `\u2022 ${m.subject}${readFlag}${attachFlag}\n  From: ${m.from} | ${date}\n  ${m.preview}${link}`;
  });

  return `Outlook Emails (${result.total} results):\n\n${lines.join("\n\n")}${q}`;
}
