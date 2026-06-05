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

export interface MailQueryOptions {
  dateFrom?: string;
  dateTo?: string;
  unreadOnly?: boolean;
  fromSender?: string;
  hasAttachments?: boolean;
  /** Free-text keywords to search for (LLM-provided). */
  searchText?: string;
}

/**
 * Builds the Graph request purely from structured LLM-provided filters.
 * Note: Graph cannot combine $filter and $search on /messages, so when any
 * structured filter is present we use $filter and ignore free-text search.
 */
function buildMailRequest(opts: MailQueryOptions): { filter?: string; search?: string; top: number } {
  const top = 20;
  const clauses: string[] = [];

  if (opts.fromSender) {
    clauses.push(`from/emailAddress/address eq '${escapeOData(opts.fromSender)}'`);
  }
  if (opts.unreadOnly) {
    clauses.push("isRead eq false");
  }
  if (opts.hasAttachments) {
    clauses.push("hasAttachments eq true");
  }
  if (opts.dateFrom) {
    clauses.push(`receivedDateTime ge ${escapeOData(opts.dateFrom)}T00:00:00Z`);
  }
  if (opts.dateTo) {
    clauses.push(`receivedDateTime le ${escapeOData(opts.dateTo)}T23:59:59Z`);
  }

  if (clauses.length > 0) {
    return { filter: clauses.join(" and "), top };
  }

  const text = opts.searchText?.trim();
  if (text && text.length > 2) {
    return { search: `"${escapeOData(text)}"`, top };
  }

  return { top: 15 };
}

export async function queryOutlookMail(
  client: Client,
  userEmail: string,
  query: string,
  opts: MailQueryOptions = {},
): Promise<OutlookMailResult> {
  void query;
  const { filter, search, top } = buildMailRequest(opts);

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
