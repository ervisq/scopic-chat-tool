import { getUserCredentials } from "../lib/credential-store";
import { getMicrosoftAccessToken } from "./microsoftTokenManager";
import { queryOutlookMail, formatMailResult } from "./outlookMailService";
import { queryOutlookCalendar, formatCalendarResult } from "./outlookCalendarService";
import { queryOutlookContacts, formatContactsResult } from "./outlookContactsService";

const MS_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || "";
const MS_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || "";

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

export async function queryOutlookDirect(
  query: string,
  userId: number,
): Promise<{ reply: string }> {
  if (!MS_CLIENT_ID || !MS_CLIENT_SECRET) {
    return { reply: "Microsoft Outlook integration is not configured on this server. Server admin needs to set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET." };
  }

  const stored = await getUserCredentials(userId, "microsoft");
  if (!stored) {
    return { reply: "You haven't connected your Microsoft account yet. Go to Connected Services to link it." };
  }

  const { refreshToken } = stored.credentials;
  if (!refreshToken) {
    return { reply: "Microsoft credentials are incomplete. Please disconnect and reconnect Microsoft in Connected Services." };
  }

  try {
    const accessToken = await getMicrosoftAccessToken(MS_CLIENT_ID, MS_CLIENT_SECRET, refreshToken);
    const category = detectCategory(query);

    switch (category) {
      case "calendar": {
        const result = await queryOutlookCalendar(accessToken, query);
        return { reply: formatCalendarResult(result, query) };
      }
      case "contacts": {
        const result = await queryOutlookContacts(accessToken, query);
        return { reply: formatContactsResult(result, query) };
      }
      case "mail":
      default: {
        const result = await queryOutlookMail(accessToken, query);
        return { reply: formatMailResult(result, query) };
      }
    }
  } catch (err: any) {
    const status = err?.response?.status;
    const msg = err?.response?.data?.error?.message || err?.message || String(err);

    if (status === 401 || msg.includes("expired") || msg.includes("invalid_grant")) {
      return { reply: "Microsoft authorization has expired. Please disconnect and reconnect Microsoft in Connected Services." };
    }

    console.error("Outlook query error:", msg);
    return { reply: `Microsoft Outlook error: ${msg}` };
  }
}
