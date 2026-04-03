import axios from "axios";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

interface CalendarEvent {
  subject: string;
  startTime: string;
  endTime: string;
  location: string;
  attendees: string[];
  isAllDay: boolean;
  organizer: string;
  status: string;
}

interface OutlookCalendarResult {
  type: "events";
  events: CalendarEvent[];
  total: number;
  source: "live";
}

function mapEvent(e: any): CalendarEvent {
  return {
    subject: e.subject || "(No Title)",
    startTime: e.start?.dateTime || "",
    endTime: e.end?.dateTime || "",
    location: e.location?.displayName || "",
    attendees: (e.attendees || []).map(
      (a: any) => a.emailAddress?.name || a.emailAddress?.address || "Unknown",
    ),
    isAllDay: !!e.isAllDay,
    organizer: e.organizer?.emailAddress?.name || e.organizer?.emailAddress?.address || "",
    status: e.showAs || "busy",
  };
}

function getDateRange(query: string): { startDateTime: string; endDateTime: string } {
  const lower = query.toLowerCase();
  const now = new Date();

  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  if (lower.includes("today") || lower.includes("schedule")) {
    return {
      startDateTime: startOfDay.toISOString(),
      endDateTime: endOfDay.toISOString(),
    };
  }

  if (lower.includes("tomorrow")) {
    const start = new Date(startOfDay);
    start.setDate(start.getDate() + 1);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { startDateTime: start.toISOString(), endDateTime: end.toISOString() };
  }

  if (lower.includes("this week") || lower.includes("week")) {
    const dayOfWeek = now.getDay();
    const monday = new Date(startOfDay);
    monday.setDate(monday.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 7);
    return { startDateTime: monday.toISOString(), endDateTime: sunday.toISOString() };
  }

  if (lower.includes("next week")) {
    const dayOfWeek = now.getDay();
    const nextMonday = new Date(startOfDay);
    nextMonday.setDate(nextMonday.getDate() + (7 - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)));
    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextSunday.getDate() + 7);
    return { startDateTime: nextMonday.toISOString(), endDateTime: nextSunday.toISOString() };
  }

  if (lower.includes("this month") || lower.includes("month")) {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { startDateTime: monthStart.toISOString(), endDateTime: monthEnd.toISOString() };
  }

  const upcoming = new Date(now);
  upcoming.setDate(upcoming.getDate() + 7);
  return { startDateTime: now.toISOString(), endDateTime: upcoming.toISOString() };
}

export async function queryOutlookCalendar(
  accessToken: string,
  query: string,
): Promise<OutlookCalendarResult> {
  const { startDateTime, endDateTime } = getDateRange(query);

  const url = `${GRAPH_BASE}/me/calendarView`;
  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.timezone="UTC"',
    },
    params: {
      startDateTime,
      endDateTime,
      $top: "50",
      $orderby: "start/dateTime",
      $select: "subject,start,end,location,attendees,isAllDay,organizer,showAs",
    },
  });

  const events = (response.data.value || []).map(mapEvent);
  return { type: "events", events, total: events.length, source: "live" };
}

export function formatCalendarResult(result: OutlookCalendarResult, query: string): string {
  const q = `\n\nQuery: "${query}"`;

  if (result.events.length === 0) return `No calendar events found for the requested period.${q}`;

  const lines = result.events.map((e) => {
    const start = e.startTime ? new Date(e.startTime).toLocaleString() : "TBD";
    const end = e.endTime ? new Date(e.endTime).toLocaleString() : "TBD";
    const timeStr = e.isAllDay ? "All Day" : `${start} - ${end}`;
    const loc = e.location ? ` | Location: ${e.location}` : "";
    const attn = e.attendees.length > 0 ? ` | Attendees: ${e.attendees.join(", ")}` : "";
    return `• ${e.subject}\n  ${timeStr}${loc}${attn}`;
  });

  return `Outlook Calendar (${result.total} events):\n\n${lines.join("\n\n")}${q}`;
}
