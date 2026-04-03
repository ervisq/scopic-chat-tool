import type { Client } from "@microsoft/microsoft-graph-client";

export interface CalendarEvent {
  subject: string;
  startTime: string;
  endTime: string;
  location: string;
  attendees: string[];
  isAllDay: boolean;
  organizer: string;
  status: string;
}

interface FreeSlot {
  start: string;
  end: string;
  durationMinutes: number;
}

type CalendarResultType = "events" | "free_time";

interface OutlookCalendarResult {
  type: CalendarResultType;
  events: CalendarEvent[];
  freeSlots?: FreeSlot[];
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

function isFreeTimeQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return (
    lower.includes("free time") ||
    lower.includes("free slot") ||
    lower.includes("available") ||
    lower.includes("availability") ||
    lower.includes("open slot") ||
    lower.includes("when am i free") ||
    lower.includes("gaps")
  );
}

function computeFreeSlots(
  events: CalendarEvent[],
  windowStart: Date,
  windowEnd: Date,
  workDayStartHour: number = 9,
  workDayEndHour: number = 17,
): FreeSlot[] {
  const slots: FreeSlot[] = [];

  const busyEvents = events
    .filter((e) => !e.isAllDay && e.status !== "free")
    .map((e) => ({
      start: new Date(e.startTime + (e.startTime.includes("Z") ? "" : "Z")),
      end: new Date(e.endTime + (e.endTime.includes("Z") ? "" : "Z")),
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const current = new Date(windowStart);
  const end = new Date(windowEnd);

  while (current < end) {
    const dayStart = new Date(current);
    dayStart.setHours(workDayStartHour, 0, 0, 0);
    const dayEnd = new Date(current);
    dayEnd.setHours(workDayEndHour, 0, 0, 0);

    if (dayStart.getDay() !== 0 && dayStart.getDay() !== 6) {
      const effectiveStart = dayStart < windowStart ? new Date(windowStart) : dayStart;
      const effectiveEnd = dayEnd > end ? end : dayEnd;

      const dayBusy = busyEvents.filter(
        (b) => b.start < effectiveEnd && b.end > effectiveStart,
      );

      let cursor = effectiveStart.getTime();

      for (const busy of dayBusy) {
        const busyStart = Math.max(busy.start.getTime(), effectiveStart.getTime());
        if (cursor < busyStart) {
          const durationMin = Math.round((busyStart - cursor) / 60000);
          if (durationMin >= 15) {
            slots.push({
              start: new Date(cursor).toISOString(),
              end: new Date(busyStart).toISOString(),
              durationMinutes: durationMin,
            });
          }
        }
        cursor = Math.max(cursor, Math.min(busy.end.getTime(), effectiveEnd.getTime()));
      }

      if (cursor < effectiveEnd.getTime()) {
        const durationMin = Math.round((effectiveEnd.getTime() - cursor) / 60000);
        if (durationMin >= 15) {
          slots.push({
            start: new Date(cursor).toISOString(),
            end: effectiveEnd.toISOString(),
            durationMinutes: durationMin,
          });
        }
      }
    }

    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);
  }

  return slots;
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
  client: Client,
  userEmail: string,
  query: string,
): Promise<OutlookCalendarResult> {
  const { startDateTime, endDateTime } = getDateRange(query);

  const response = await client
    .api(`/users/${userEmail}/calendarView`)
    .query({ startDateTime, endDateTime })
    .top(50)
    .orderby("start/dateTime")
    .select("subject,start,end,location,attendees,isAllDay,organizer,showAs")
    .header("Prefer", 'outlook.timezone="UTC"')
    .get();

  const events = (response.value || []).map(mapEvent);

  if (isFreeTimeQuery(query)) {
    const freeSlots = computeFreeSlots(
      events,
      new Date(startDateTime),
      new Date(endDateTime),
    );
    return { type: "free_time", events, freeSlots, total: freeSlots.length, source: "live" };
  }

  return { type: "events", events, total: events.length, source: "live" };
}

export async function getUpcomingEvents(
  client: Client,
  userEmail: string,
  count: number = 5,
): Promise<CalendarEvent[]> {
  const now = new Date();
  const endWindow = new Date(now);
  endWindow.setDate(endWindow.getDate() + 7);

  const response = await client
    .api(`/users/${userEmail}/calendarView`)
    .query({
      startDateTime: now.toISOString(),
      endDateTime: endWindow.toISOString(),
    })
    .top(count)
    .orderby("start/dateTime")
    .select("subject,start,end,location,isAllDay,organizer,showAs")
    .header("Prefer", 'outlook.timezone="UTC"')
    .get();

  return (response.value || []).map(mapEvent);
}

export function formatCalendarResult(result: OutlookCalendarResult, query: string): string {
  const q = `\n\nQuery: "${query}"`;

  if (result.type === "free_time" && result.freeSlots) {
    if (result.freeSlots.length === 0) {
      return `No free time slots found in the requested period (work hours: 9 AM - 5 PM, weekdays).${q}`;
    }

    const lines = result.freeSlots.map((s) => {
      const start = new Date(s.start).toLocaleString();
      const end = new Date(s.end).toLocaleString();
      const hours = Math.floor(s.durationMinutes / 60);
      const mins = s.durationMinutes % 60;
      const duration = hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}m` : ""}` : `${mins}m`;
      return `\u2022 ${start} - ${end} (${duration})`;
    });

    return `Free Time Slots (${result.freeSlots.length} available, work hours 9 AM - 5 PM):\n\n${lines.join("\n")}${q}`;
  }

  if (result.events.length === 0) return `No calendar events found for the requested period.${q}`;

  const lines = result.events.map((e) => {
    const start = e.startTime ? new Date(e.startTime).toLocaleString() : "TBD";
    const end = e.endTime ? new Date(e.endTime).toLocaleString() : "TBD";
    const timeStr = e.isAllDay ? "All Day" : `${start} - ${end}`;
    const loc = e.location ? ` | Location: ${e.location}` : "";
    const attn = e.attendees.length > 0 ? ` | Attendees: ${e.attendees.join(", ")}` : "";
    return `\u2022 ${e.subject}\n  ${timeStr}${loc}${attn}`;
  });

  return `Outlook Calendar (${result.total} events):\n\n${lines.join("\n\n")}${q}`;
}
