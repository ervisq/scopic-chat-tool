import { getGraphClient, isGraphConfigured } from "./microsoftGraphClient";
import { queryOutlookMail, formatMailResult } from "./outlookMailService";
import { queryOutlookCalendar, formatCalendarResult } from "./outlookCalendarService";
import { queryOutlookContacts, formatContactsResult } from "./outlookContactsService";
import { db } from "@workspace/db";
import { users } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export type OutlookCategory = "mail" | "calendar" | "contacts";

/** All Outlook decisions come from the LLM router; nothing is parsed from the message. */
export interface OutlookQueryOptions {
  category?: OutlookCategory;
  /** YYYY-MM-DD, LLM-resolved. */
  dateFrom?: string;
  dateTo?: string;
  /** mail filters */
  unreadOnly?: boolean;
  fromSender?: string;
  hasAttachments?: boolean;
  /** calendar: compute free/available slots instead of listing events */
  freeTime?: boolean;
}

const verifiedMailboxes = new Map<string, { verified: boolean; expiresAt: number }>();
const MAILBOX_CACHE_TTL_MS = 30 * 60 * 1000;

async function getUserEmail(userId: number): Promise<string | null> {
  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  return user?.email || null;
}

async function verifyMailboxExists(email: string): Promise<boolean> {
  const cached = verifiedMailboxes.get(email);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.verified;
  }

  try {
    const client = getGraphClient();
    await client.api(`/users/${email}`).select("id,mail").get();
    verifiedMailboxes.set(email, { verified: true, expiresAt: Date.now() + MAILBOX_CACHE_TTL_MS });
    return true;
  } catch (err: any) {
    const status = err?.statusCode || err?.response?.status;
    if (status === 404) {
      verifiedMailboxes.set(email, { verified: false, expiresAt: Date.now() + MAILBOX_CACHE_TTL_MS });
      return false;
    }
    throw err;
  }
}

export async function queryOutlookDirect(
  query: string,
  userId: number,
  opts: OutlookQueryOptions = {},
): Promise<{ reply: string }> {
  if (!isGraphConfigured()) {
    return { reply: "Microsoft Outlook integration is not configured on this server. Server admin needs to set MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, and MICROSOFT_CLIENT_SECRET." };
  }

  const userEmail = await getUserEmail(userId);
  if (!userEmail) {
    return { reply: "Could not determine your email address. Please contact an administrator." };
  }

  try {
    const mailboxValid = await verifyMailboxExists(userEmail);
    if (!mailboxValid) {
      return { reply: `No Microsoft 365 mailbox found for ${userEmail}. Your registered email must match an active mailbox in the organization's Azure AD tenant.` };
    }

    const client = getGraphClient();
    const category = opts.category || "mail";

    switch (category) {
      case "calendar": {
        const result = await queryOutlookCalendar(client, userEmail, query, {
          dateFrom: opts.dateFrom,
          dateTo: opts.dateTo,
          freeTime: opts.freeTime,
        });
        return { reply: formatCalendarResult(result, query) };
      }
      case "contacts": {
        const result = await queryOutlookContacts(client, userEmail, query);
        return { reply: formatContactsResult(result, query) };
      }
      case "mail":
      default: {
        const result = await queryOutlookMail(client, userEmail, query, {
          dateFrom: opts.dateFrom,
          dateTo: opts.dateTo,
          unreadOnly: opts.unreadOnly,
          fromSender: opts.fromSender,
          hasAttachments: opts.hasAttachments,
          searchText: query,
        });
        return { reply: formatMailResult(result, query) };
      }
    }
  } catch (err: any) {
    const status = err?.statusCode || err?.response?.status;
    const msg = err?.message || String(err);

    if (status === 404) {
      return { reply: `Microsoft Outlook could not find a mailbox for ${userEmail}. Make sure this email has an active Microsoft 365 mailbox.` };
    }

    if (status === 403) {
      return { reply: "Microsoft Outlook access denied. Your organization's admin may need to grant the app permission to read your mailbox." };
    }

    console.error("Outlook query error:", msg);
    return { reply: `Microsoft Outlook error: ${msg}` };
  }
}
