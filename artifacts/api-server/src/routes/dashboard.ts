import { Router, type IRouter } from "express";
import { getAuthUser } from "../middlewares/auth";
import { listUserConnections, getUserCredentials } from "../lib/credential-store";
import { queryJira } from "../services/jiraService";
import { queryZohoPeople } from "../services/zohoPeopleService";
import { queryZohoCrm } from "../services/zohoCrmService";
import { queryZohoRecruit } from "../services/zohoRecruitService";
import { queryZohoContracts } from "../services/zohoContractsService";
import { ZohoPermissionError } from "../services/zohoTokenManager";
import { querySts } from "../services/stsService";
import { queryTeamwork } from "../services/teamworkService";
import { getGraphClient, isGraphConfigured } from "../services/microsoftGraphClient";
import { getRecentEmails } from "../services/outlookMailService";
import { getUpcomingEvents } from "../services/outlookCalendarService";
import type { ZohoLeaveRequest, ZohoEmployee } from "../services/zohoPeopleService";
import type { ZohoDeal, ZohoLead, ZohoTask } from "../services/zohoCrmService";
import type { RecruitInterview } from "../services/zohoRecruitService";
import { getCachedDashboard, setCachedDashboard } from "../lib/dashboard-cache";

const router: IRouter = Router();

interface ServiceSummary {
  key: string;
  name: string;
  connected: boolean;
  instanceUrl?: string | null;
  summary?: Record<string, unknown>;
  error?: string;
  accessible?: boolean;
  suite?: boolean;
}

async function getZohoTokens(userId: number) {
  const cred = await getUserCredentials(userId, "zoho");
  if (!cred) return null;
  const { refreshToken } = cred.credentials;
  const clientId = process.env.ZOHO_CLIENT_ID || "";
  const clientSecret = process.env.ZOHO_CLIENT_SECRET || "";
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { refreshToken, clientId, clientSecret };
}

router.get("/dashboard", async (req, res) => {
  try {
    const auth = getAuthUser(req);
    const { userId } = auth;

    if (req.query.fresh !== "1") {
      const cached = getCachedDashboard(userId);
      if (cached) {
        res.json(cached);
        return;
      }
    }

    const connections = await listUserConnections(userId);

    const connMap = new Map(connections.map((c) => [c.provider, c]));

    const services: ServiceSummary[] = [];
    const promises: Promise<void>[] = [];

    const jiraConn = connMap.get("jira");
    if (jiraConn) {
      promises.push(
        (async () => {
          try {
            const result = await queryJira("my tasks", userId);
            if (result.source === "error") {
              services.push({
                key: "jira",
                name: "JIRA",
                connected: true,
                instanceUrl: jiraConn.instanceUrl,
                error: "Could not load Jira data — check your credentials",
              });
            } else {
              const openTickets = result.tickets.filter((t) => t.status !== "Done");
              services.push({
                key: "jira",
                name: "JIRA",
                connected: true,
                instanceUrl: jiraConn.instanceUrl,
                summary: {
                  totalTickets: result.total,
                  openTickets: openTickets.length,
                  tickets: result.tickets.map((t) => ({
                    id: t.id,
                    title: t.title,
                    status: t.status,
                    priority: t.priority,
                    project: t.project,
                    assignee: t.assignee,
                  })),
                },
              });
            }
          } catch {
            services.push({
              key: "jira",
              name: "JIRA",
              connected: true,
              instanceUrl: jiraConn.instanceUrl,
              error: "Could not load Jira data",
            });
          }
        })(),
      );
    } else {
      services.push({ key: "jira", name: "JIRA", connected: false });
    }

    const zohoConn = connMap.get("zoho");
    services.push({ key: "zoho", name: "Zoho", connected: !!zohoConn, suite: true });
    if (zohoConn) {
      const zohoTokens = await getZohoTokens(userId);
      if (!zohoTokens) {
        services.push({
          key: "zoho_people",
          name: "Zoho People",
          connected: true,
          accessible: true,
          summary: { status: "Reconnect needed — token expired" },
        });
        services.push({
          key: "zoho_crm",
          name: "Zoho CRM",
          connected: true,
          accessible: true,
          summary: { status: "Reconnect needed — token expired" },
        });
        services.push({
          key: "zoho_recruit",
          name: "Zoho Recruit",
          connected: true,
          accessible: true,
          summary: { status: "Reconnect needed — token expired" },
        });
        services.push({
          key: "zoho_contracts",
          name: "Zoho Contracts",
          connected: true,
          accessible: true,
          summary: { status: "Reconnect needed — token expired" },
        });
      } else {
        promises.push(
          (async () => {
            try {
              const [headcountRes, leaveRes, joinersRes] = await Promise.allSettled([
                queryZohoPeople("headcount", zohoTokens.clientId, zohoTokens.clientSecret, zohoTokens.refreshToken, "https://accounts.zoho.com"),
                queryZohoPeople("who is on leave today", zohoTokens.clientId, zohoTokens.clientSecret, zohoTokens.refreshToken, "https://accounts.zoho.com"),
                queryZohoPeople("new joiners this month", zohoTokens.clientId, zohoTokens.clientSecret, zohoTokens.refreshToken, "https://accounts.zoho.com"),
              ]);

              if (headcountRes.status === "rejected" && leaveRes.status === "rejected" && joinersRes.status === "rejected") {
                throw headcountRes.reason ?? leaveRes.reason ?? joinersRes.reason ?? new Error("All People requests failed");
              }

              const employeeCount = headcountRes.status === "fulfilled" ? headcountRes.value.total : 0;
              const todayLeave: ZohoLeaveRequest[] = leaveRes.status === "fulfilled" ? (leaveRes.value.leaveRequests || []) : [];
              const recentJoiners: ZohoEmployee[] = joinersRes.status === "fulfilled"
                ? [...(joinersRes.value.employees || [])].sort((a, b) => (b.dateOfJoining || "").localeCompare(a.dateOfJoining || "")).slice(0, 5)
                : [];

              const statusParts: string[] = [];
              if (headcountRes.status === "fulfilled") statusParts.push(`${employeeCount} employee${employeeCount !== 1 ? "s" : ""}`);
              if (leaveRes.status === "fulfilled") statusParts.push(`${todayLeave.length} on leave today`);
              if (joinersRes.status === "fulfilled") statusParts.push(`${recentJoiners.length} joined this month`);

              services.push({
                key: "zoho_people",
                name: "Zoho People",
                connected: true,
                accessible: true,
                summary: {
                  status: statusParts.join(" · ") || "Connected",
                  employeeCount,
                  onLeaveTodayCount: todayLeave.length,
                  recentJoinersCount: recentJoiners.length,
                  onLeaveToday: todayLeave.slice(0, 8).map((l) => ({
                    employee: l.employee,
                    leaveType: l.leaveType,
                    from: l.from,
                    to: l.to,
                    dayCount: l.dayCount,
                  })),
                  recentJoiners: recentJoiners.map((e) => ({
                    id: e.id,
                    name: e.name,
                    designation: e.designation,
                    department: e.department,
                    dateOfJoining: e.dateOfJoining,
                  })),
                },
              });
            } catch (err: unknown) {
              const isPerm = err instanceof ZohoPermissionError;
              services.push({
                key: "zoho_people",
                name: "Zoho People",
                connected: true,
                accessible: !isPerm,
                summary: isPerm ? undefined : { status: "Connected" },
                error: isPerm ? "People access not granted — reconnect Zoho with People permissions." : undefined,
              });
            }
          })(),
        );

        promises.push(
          (async () => {
            try {
              const today = new Date();
              const yyyymmdd = (d: Date) => d.toISOString().slice(0, 10);
              const todayStr = yyyymmdd(today);
              const weekAgo = new Date(today);
              weekAgo.setDate(weekAgo.getDate() - 7);

              const [leadsRes, dealsRes, recentLeadsRes, tasksRes] = await Promise.allSettled([
                queryZohoCrm("leads", zohoTokens.clientId, zohoTokens.clientSecret, zohoTokens.refreshToken, "https://accounts.zoho.com", { module: "leads" }),
                queryZohoCrm("deals", zohoTokens.clientId, zohoTokens.clientSecret, zohoTokens.refreshToken, "https://accounts.zoho.com", { module: "deals" }),
                queryZohoCrm("recent leads", zohoTokens.clientId, zohoTokens.clientSecret, zohoTokens.refreshToken, "https://accounts.zoho.com", {
                  module: "leads",
                  dateField: "Created_Time",
                  dateRangeStart: yyyymmdd(weekAgo),
                  dateRangeEnd: todayStr,
                }),
                queryZohoCrm("tasks due today", zohoTokens.clientId, zohoTokens.clientSecret, zohoTokens.refreshToken, "https://accounts.zoho.com", {
                  module: "tasks",
                  dateField: "Due_Date",
                  dateRangeStart: todayStr,
                  dateRangeEnd: todayStr,
                }),
              ]);

              if (leadsRes.status === "rejected" && dealsRes.status === "rejected" && recentLeadsRes.status === "rejected" && tasksRes.status === "rejected") {
                throw leadsRes.reason ?? dealsRes.reason ?? recentLeadsRes.reason ?? tasksRes.reason ?? new Error("All CRM requests failed");
              }

              const totalLeads = leadsRes.status === "fulfilled" ? (leadsRes.value.total ?? 0) : 0;

              const allDeals: ZohoDeal[] = dealsRes.status === "fulfilled" ? (dealsRes.value.deals || []) : [];
              const closedStages = /closed.?(won|lost)/i;
              const openDealsAll = allDeals.filter((d) => !closedStages.test(d.stage || ""));
              const parseAmount = (s: string): number => {
                const n = parseFloat((s || "").replace(/[^0-9.\-]/g, ""));
                return isNaN(n) ? 0 : n;
              };
              const openPipeline = openDealsAll.reduce((sum, d) => sum + parseAmount(d.amount), 0);
              const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
              const closingThisMonth = openDealsAll.filter((d) => {
                if (!d.closingDate) return false;
                const cd = new Date(d.closingDate);
                return !isNaN(cd.getTime()) && cd >= today && cd <= monthEnd;
              }).length;
              const topOpenDeals = [...openDealsAll]
                .sort((a, b) => parseAmount(b.amount) - parseAmount(a.amount))
                .slice(0, 5);

              const recentLeads: ZohoLead[] = recentLeadsRes.status === "fulfilled" ? (recentLeadsRes.value.leads || []).slice(0, 5) : [];
              const tasksToday: ZohoTask[] = tasksRes.status === "fulfilled" ? (tasksRes.value.tasks || []) : [];

              const formatMoney = (n: number): string => {
                if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
                if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
                if (n > 0) return `$${n.toFixed(0)}`;
                return "$0";
              };

              const statusParts: string[] = [];
              if (leadsRes.status === "fulfilled") statusParts.push(`${totalLeads} lead${totalLeads !== 1 ? "s" : ""}`);
              if (dealsRes.status === "fulfilled") {
                statusParts.push(`${formatMoney(openPipeline)} open pipeline`);
                if (closingThisMonth > 0) statusParts.push(`${closingThisMonth} closing this month`);
              }

              services.push({
                key: "zoho_crm",
                name: "Zoho CRM",
                connected: true,
                accessible: true,
                summary: {
                  status: statusParts.join(" · ") || "Connected",
                  leadCount: totalLeads,
                  openPipelineFormatted: dealsRes.status === "fulfilled" ? formatMoney(openPipeline) : undefined,
                  openDealsCount: openDealsAll.length,
                  closingThisMonthCount: closingThisMonth,
                  recentLeadsCount: recentLeads.length,
                  tasksDueTodayCount: tasksToday.length,
                  openDeals: topOpenDeals.map((d) => ({
                    id: d.id,
                    name: d.name,
                    stage: d.stage,
                    amount: d.amount,
                    closingDate: d.closingDate,
                    account: d.account,
                  })),
                  recentLeads: recentLeads.map((l) => ({
                    id: l.id,
                    name: l.name,
                    company: l.company,
                    leadStatus: l.status,
                    email: l.email,
                  })),
                  tasksDueToday: tasksToday.slice(0, 5).map((t) => ({
                    id: t.id,
                    subject: t.subject,
                    status: t.status,
                    priority: t.priority,
                    relatedTo: t.relatedTo,
                  })),
                },
              });
            } catch (err: unknown) {
              const isPerm = err instanceof ZohoPermissionError;
              services.push({
                key: "zoho_crm",
                name: "Zoho CRM",
                connected: true,
                accessible: !isPerm,
                summary: isPerm ? undefined : { status: "Connected" },
                error: isPerm ? "CRM access not granted — reconnect Zoho with CRM permissions." : undefined,
              });
            }
          })(),
        );


        promises.push(
          (async () => {
            try {
              const [pipelineRes, interviewsRes] = await Promise.allSettled([
                queryZohoRecruit("pipeline", zohoTokens.clientId, zohoTokens.clientSecret, zohoTokens.refreshToken, "https://accounts.zoho.com", { module: "pipeline" }),
                queryZohoRecruit("interviews this week", zohoTokens.clientId, zohoTokens.clientSecret, zohoTokens.refreshToken, "https://accounts.zoho.com", { module: "interviews" }),
              ]);

              if (pipelineRes.status === "rejected") {
                throw pipelineRes.reason;
              }

              const result = pipelineRes.value;
              const allCandidates = result.candidates || [];
              const allJobs = result.jobOpenings || [];
              const closedStatuses = new Set(["closed", "filled", "cancelled", "on hold", "on-hold"]);
              const openJobs = allJobs.filter(
                (j) => !closedStatuses.has((j.jobStatus || "").toLowerCase()),
              );

              const now = new Date();
              const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
              const allInterviews: RecruitInterview[] = interviewsRes.status === "fulfilled" ? (interviewsRes.value.interviews || []) : [];
              const upcomingInterviews = allInterviews
                .filter((i) => {
                  if (!i.interviewDate) return false;
                  const d = new Date(i.interviewDate);
                  return !isNaN(d.getTime()) && d >= now && d <= weekFromNow;
                })
                .sort((a, b) => (a.interviewDate || "").localeCompare(b.interviewDate || ""))
                .slice(0, 3);

              services.push({
                key: "zoho_recruit",
                name: "Zoho Recruit",
                connected: true,
                accessible: true,
                summary: {
                  status: `${openJobs.length} open position${openJobs.length !== 1 ? "s" : ""}, ${allCandidates.length} candidate${allCandidates.length !== 1 ? "s" : ""}${upcomingInterviews.length ? `, ${upcomingInterviews.length} interview${upcomingInterviews.length !== 1 ? "s" : ""} this week` : ""}`,
                  openPositions: openJobs.length,
                  candidateCount: allCandidates.length,
                  upcomingInterviewsCount: upcomingInterviews.length,
                  upcomingInterviews: upcomingInterviews.map((i) => ({
                    id: i.id,
                    interviewName: i.interviewName,
                    candidateName: i.candidateName,
                    interviewDate: i.interviewDate,
                    from: i.from,
                    to: i.to,
                    jobOpeningName: i.jobOpeningName,
                    status: i.status,
                  })),
                  candidates: allCandidates.slice(0, 8).map((c) => ({
                    id: c.id,
                    name: c.name,
                    email: c.email,
                    status: c.candidateStatus,
                    currentJobTitle: c.currentJobTitle,
                    currentEmployer: c.currentEmployer,
                  })),
                  jobOpenings: openJobs.slice(0, 8).map((j) => ({
                    id: j.id,
                    title: j.postingTitle,
                    department: j.department,
                    status: j.jobStatus,
                    positions: j.numberOfPositions,
                  })),
                },
              });
            } catch (err: unknown) {
              const isPerm = err instanceof ZohoPermissionError;
              services.push({
                key: "zoho_recruit",
                name: "Zoho Recruit",
                connected: true,
                accessible: !isPerm,
                error: isPerm
                  ? "Recruit access not granted — reconnect Zoho with Recruit permissions."
                  : "Could not load Recruit data",
              });
            }
          })(),
        );

        promises.push(
          (async () => {
            try {
              const result = await queryZohoContracts(
                "all contracts",
                zohoTokens.clientId,
                zohoTokens.clientSecret,
                zohoTokens.refreshToken,
                "https://accounts.zoho.com",
                { limit: 50 },
              );
              const all = result.contracts || [];
              const activeContracts = all.filter((c) =>
                /active|in.?progress|signed/i.test(c.contractStatus || ""),
              );
              const now = new Date();
              const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
              const expiring = all.filter((c) => {
                if (!c.endDate) return false;
                const end = new Date(c.endDate);
                return !isNaN(end.getTime()) && end >= now && end <= thirtyDays;
              });
              const previewSource = activeContracts.length > 0 ? activeContracts : all;
              const expiringSorted = [...expiring].sort((a, b) => {
                const ad = a.endDate ? new Date(a.endDate).getTime() : Infinity;
                const bd = b.endDate ? new Date(b.endDate).getTime() : Infinity;
                return ad - bd;
              });
              const expiringContracts = expiringSorted.slice(0, 5).map((c) => ({
                id: c.id,
                contractName: c.contractName,
                contractType: c.contractType,
                contractStatus: c.contractStatus,
                company: c.company,
                startDate: c.startDate,
                endDate: c.endDate,
                contractValue: c.contractValue,
              }));
              services.push({
                key: "zoho_contracts",
                name: "Zoho Contracts",
                connected: true,
                accessible: true,
                summary: {
                  status: `${activeContracts.length} active${expiring.length ? `, ${expiring.length} expiring soon` : ""}`,
                  activeCount: activeContracts.length,
                  expiringCount: expiring.length,
                  expiringContracts,
                  totalContracts: all.length,
                  contracts: previewSource.slice(0, 8).map((c) => ({
                    id: c.id,
                    contractName: c.contractName,
                    contractType: c.contractType,
                    contractStatus: c.contractStatus,
                    company: c.company,
                    startDate: c.startDate,
                    endDate: c.endDate,
                    contractValue: c.contractValue,
                  })),
                },
              });
            } catch (err: unknown) {
              const isPerm = err instanceof ZohoPermissionError;
              services.push({
                key: "zoho_contracts",
                name: "Zoho Contracts",
                connected: true,
                accessible: !isPerm,
                error: isPerm
                  ? "Contracts access not granted — reconnect Zoho with Contracts permissions."
                  : "Could not load Contracts data",
              });
            }
          })(),
        );
      }
    } else {
      services.push({ key: "zoho_people", name: "Zoho People", connected: false, accessible: true });
      services.push({ key: "zoho_crm", name: "Zoho CRM", connected: false, accessible: true });
      services.push({ key: "zoho_recruit", name: "Zoho Recruit", connected: false, accessible: true });
      services.push({ key: "zoho_contracts", name: "Zoho Contracts", connected: false, accessible: true });
    }

    const stsConn = connMap.get("sts");
    if (stsConn) {
      promises.push(
        (async () => {
          try {
            const [thisWeekRes, lastWeekRes] = await Promise.allSettled([
              querySts("my hours this week", userId),
              querySts("my hours last week", userId),
            ]);
            if (thisWeekRes.status === "rejected") throw thisWeekRes.reason;
            const result = thisWeekRes.value;
            const lastWeekHours = lastWeekRes.status === "fulfilled" && lastWeekRes.value.source !== "error"
              ? lastWeekRes.value.totalHours
              : undefined;
            if (result.source === "error") {
              services.push({
                key: "sts",
                name: "STS",
                connected: true,
                instanceUrl: stsConn.instanceUrl,
                error: result.errorMessage || "Could not load STS data — check your token",
              });
            } else {
              const daysSummary = result.byDay
                .filter((d) => d.hours > 0)
                .map((d) => `${d.dayName.slice(0, 3)}: ${d.hours.toFixed(1)}h`)
                .join(", ");
              services.push({
                key: "sts",
                name: "STS",
                connected: true,
                instanceUrl: stsConn.instanceUrl,
                summary: {
                  status: `${result.totalHours}h logged this week`,
                  totalHours: result.totalHours,
                  lastWeekHours,
                  weekStart: result.weekStart,
                  weekEnd: result.weekEnd,
                  daysSummary: daysSummary || "No hours logged yet",
                  byProject: result.byProject.map((p) => ({
                    name: p.projectName,
                    hours: p.hours,
                  })),
                },
              });
            }
          } catch (err: unknown) {
            console.error("[Dashboard] STS fetch error:", err instanceof Error ? err.message : String(err));
            services.push({
              key: "sts",
              name: "STS",
              connected: true,
              instanceUrl: stsConn.instanceUrl,
              error: "Could not load STS data — check your token or try again later",
            });
          }
        })(),
      );
    } else {
      services.push({ key: "sts", name: "STS", connected: false });
    }

    const teamworkConn = connMap.get("teamwork");
    if (teamworkConn) {
      promises.push(
        (async () => {
          try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const dateFilter = thirtyDaysAgo.toISOString().split("T")[0];
            const result = await queryTeamwork(`my latest tasks due after ${dateFilter}`, userId);
            if (result.source === "error") {
              services.push({
                key: "teamwork",
                name: "Teamwork",
                connected: true,
                instanceUrl: teamworkConn.instanceUrl,
                error: "Could not load Teamwork data — check your credentials",
              });
            } else {
              const tasks = result.data as { id: number; name: string; status: string; priority: string; projectName: string; assignee: string; dueDate: string; taskListName: string; progress: number }[];
              const activeTasks = tasks.filter((t) => t.status.toLowerCase() !== "completed");
              const todayKey = new Date().toISOString().slice(0, 10);
              const startOfToday = new Date(`${todayKey}T00:00:00`);
              const dueTodayCount = activeTasks.filter((t) => t.dueDate && t.dueDate.slice(0, 10) === todayKey).length;
              const overdueCount = activeTasks.filter((t) => {
                if (!t.dueDate) return false;
                const d = new Date(t.dueDate);
                return !isNaN(d.getTime()) && d < startOfToday;
              }).length;
              services.push({
                key: "teamwork",
                name: "Teamwork",
                connected: true,
                instanceUrl: teamworkConn.instanceUrl,
                summary: {
                  totalTasks: result.total,
                  activeTasks: activeTasks.length,
                  dueTodayCount,
                  overdueCount,
                  status: `${activeTasks.length} active task${activeTasks.length !== 1 ? "s" : ""}${overdueCount ? ` · ${overdueCount} overdue` : ""}${dueTodayCount ? ` · ${dueTodayCount} due today` : ""}`,
                  tasks: tasks.map((t) => ({
                    id: t.id,
                    title: t.name,
                    status: t.status,
                    priority: t.priority,
                    projectName: t.projectName,
                    assignee: t.assignee,
                    dueDate: t.dueDate,
                    taskListName: t.taskListName,
                    progress: t.progress,
                  })),
                },
              });
            }
          } catch {
            services.push({
              key: "teamwork",
              name: "Teamwork",
              connected: true,
              instanceUrl: teamworkConn.instanceUrl,
              error: "Could not load Teamwork data",
            });
          }
        })(),
      );
    } else {
      services.push({ key: "teamwork", name: "Teamwork", connected: false });
    }

    if (isGraphConfigured()) {
      const userEmail = auth.email;

      if (userEmail) {
        const client = getGraphClient();

        promises.push(
          (async () => {
            try {
              const [emailsRes, unreadRes] = await Promise.allSettled([
                getRecentEmails(client, userEmail, 5),
                client.api(`/users/${userEmail}/mailFolders/Inbox/messages/$count`).filter("isRead eq false").get() as Promise<number | string>,
              ]);
              if (emailsRes.status === "rejected") throw emailsRes.reason;
              const emails = emailsRes.value;
              const unreadCountRaw = unreadRes.status === "fulfilled" ? unreadRes.value : undefined;
              const unreadCount = typeof unreadCountRaw === "number"
                ? unreadCountRaw
                : typeof unreadCountRaw === "string" && /^\d+$/.test(unreadCountRaw.trim())
                  ? parseInt(unreadCountRaw.trim(), 10)
                  : undefined;
              services.push({
                key: "outlook_email",
                name: "Outlook Email",
                connected: true,
                summary: { emails, unreadCount },
              });
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error("[Dashboard] Outlook email error:", msg);
              services.push({
                key: "outlook_email",
                name: "Outlook Email",
                connected: true,
                error: "Could not load emails",
              });
            }
          })(),
        );

        promises.push(
          (async () => {
            try {
              const events = await getUpcomingEvents(client, userEmail, 5);
              const now = new Date();
              const endOfToday = new Date();
              endOfToday.setHours(23, 59, 59, 999);
              const todayCount = events.filter((e) => {
                if (!e.startTime) return false;
                const d = new Date(e.startTime + (e.startTime.includes("Z") ? "" : "Z"));
                return !isNaN(d.getTime()) && d >= now && d <= endOfToday;
              }).length;
              const nextFuture = events
                .map((e) => ({ ...e, _start: e.startTime ? new Date(e.startTime + (e.startTime.includes("Z") ? "" : "Z")) : null }))
                .filter((e) => e._start && !isNaN(e._start.getTime()) && e._start >= now)
                .sort((a, b) => a._start!.getTime() - b._start!.getTime())[0];
              const nextEventInMinutes = nextFuture
                ? Math.max(0, Math.round((nextFuture._start!.getTime() - now.getTime()) / 60000))
                : undefined;
              services.push({
                key: "outlook_calendar",
                name: "Outlook Calendar",
                connected: true,
                summary: { events, todayCount, nextEventInMinutes },
              });
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error("[Dashboard] Outlook calendar error:", msg);
              services.push({
                key: "outlook_calendar",
                name: "Outlook Calendar",
                connected: true,
                error: "Could not load calendar events",
              });
            }
          })(),
        );
      } else {
        services.push({
          key: "outlook_email",
          name: "Outlook Email",
          connected: false,
          summary: { status: "Could not find your email address. Please contact an administrator." },
        });
        services.push({
          key: "outlook_calendar",
          name: "Outlook Calendar",
          connected: false,
          summary: { status: "Could not find your email address. Please contact an administrator." },
        });
      }
    } else {
      services.push({
        key: "outlook_email",
        name: "Outlook Email",
        connected: false,
        summary: { status: "Microsoft Outlook is not configured on this server." },
      });
      services.push({
        key: "outlook_calendar",
        name: "Outlook Calendar",
        connected: false,
        summary: { status: "Microsoft Outlook is not configured on this server." },
      });
    }

    await Promise.all(promises);

    const order = ["outlook_email", "outlook_calendar", "jira", "zoho", "zoho_people", "zoho_crm", "zoho_recruit", "zoho_contracts", "sts", "teamwork"];
    services.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

    const payload = { services };
    setCachedDashboard(userId, payload);
    res.json(payload);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Dashboard error:", msg);
    res.status(500).json({ message: "Failed to load dashboard" });
  }
});

export default router;
