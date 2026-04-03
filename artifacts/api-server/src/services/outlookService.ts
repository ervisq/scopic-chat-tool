import { getGraphClient, isGraphConfigured } from "./microsoftGraphClient";
import { queryOutlookMail, formatMailResult } from "./outlookMailService";
import { queryOutlookCalendar, formatCalendarResult } from "./outlookCalendarService";
import { queryOutlookContacts, formatContactsResult } from "./outlookContactsService";
import { db } from "@workspace/db";
import { users } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

type OutlookCategory = "mail" | "calendar" | "contacts";

function detectCategory(query: string): OutlookCategory {
  const lower = query.toLowerCase();

  if (
    lower.includes("calendar") ||
    lower.includes("meeting") ||
    lower.includes("schedule") ||
    lower.includes("event") ||
    lower.includes("appointment") ||
    lower.includes("busy") ||
    lower.includes("free time") ||
    lower.includes("free slot") ||
    lower.includes("availability") ||
    lower.includes("today's agenda") ||
    lower.includes("agenda")
  ) {
    return "calendar";
  }

  if (
    lower.includes("contact") ||
    lower.includes("phone") ||
    lower.includes("address book") ||
    lower.includes("phone number") ||
    lower.includes("find person") ||
    lower.includes("look up person")
  ) {
    return "contacts";
  }

  return "mail";
}

async function getUserEmail(userId: number): Promise<string | null> {
  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  return user?.email || null;
}

export async function queryOutlookDirect(
  query: string,
  userId: number,
): Promise<{ reply: string }> {
  if (!isGraphConfigured()) {
    return { reply: "Microsoft Outlook integration is not configured on this server. Server admin needs to set MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, and MICROSOFT_CLIENT_SECRET." };
  }

  const userEmail = await getUserEmail(userId);
  if (!userEmail) {
    return { reply: "Could not determine your email address. Please contact an administrator." };
  }

  try {
    const client = getGraphClient();
    const category = detectCategory(query);

    switch (category) {
      case "calendar": {
        const result = await queryOutlookCalendar(client, userEmail, query);
        return { reply: formatCalendarResult(result, query) };
      }
      case "contacts": {
        const result = await queryOutlookContacts(client, userEmail, query);
        return { reply: formatContactsResult(result, query) };
      }
      case "mail":
      default: {
        const result = await queryOutlookMail(client, userEmail, query);
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
