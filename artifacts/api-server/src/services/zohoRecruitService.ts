import axios from "axios";
import { getZohoAccessToken, ZohoPermissionError } from "./zohoTokenManager";
import { getRecruitBaseUrl } from "./zohoDomainUtils";

export interface RecruitCandidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  currentEmployer: string;
  currentJobTitle: string;
  experienceYears: string;
  candidateStatus: string;
  source: string;
  createdTime: string;
  city: string;
  skill: string;
}

export interface RecruitJobOpening {
  id: string;
  postingTitle: string;
  department: string;
  numberOfPositions: string;
  jobStatus: string;
  dateOpened: string;
  targetDate: string;
  jobType: string;
  industry: string;
  salary: string;
  city: string;
  assignedRecruiter: string;
}

export interface RecruitInterview {
  id: string;
  interviewName: string;
  candidateName: string;
  interviewDate: string;
  from: string;
  to: string;
  interviewers: string;
  location: string;
  scheduleComments: string;
  status: string;
  jobOpeningName: string;
}

export type RecruitResultType = "candidates" | "job_openings" | "interviews" | "pipeline";

export type RecruitDateField = "Created_Time" | "Modified_Time" | "Date_Opened" | "Target_Date" | "Interview_Date";

export interface RecruitSearchOptions {
  module?: string;
  searchEntity?: string;
  statusFilter?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  dateField?: string;
  recruiterFilter?: "me" | "all";
}

export interface ZohoRecruitResult {
  type: RecruitResultType;
  candidates?: RecruitCandidate[];
  jobOpenings?: RecruitJobOpening[];
  interviews?: RecruitInterview[];
  total: number;
  source: "live" | "error";
  searchEntity?: string;
  statusFilter?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  dateField?: string;
}

const DEFAULT_LIMIT = 200;

const VALID_DATE_FIELDS = new Set<string>(["Created_Time", "Modified_Time", "Date_Opened", "Target_Date", "Interview_Date"]);

const DEFAULT_DATE_FIELD_MAP: Record<string, RecruitDateField> = {
  Candidates: "Created_Time",
  Job_Openings: "Date_Opened",
  Interviews: "Interview_Date",
};

const STATUS_FIELD_MAP: Record<string, string> = {
  Candidates: "Candidate_Status",
  Job_Openings: "Job_Opening_Status",
  Interviews: "Interview_Status",
};

function str(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "object" && val !== null && "name" in val) return String((val as Record<string, unknown>).name || "");
  return String(val);
}

function mapCandidate(r: Record<string, unknown>): RecruitCandidate {
  return {
    id: str(r.id),
    name: `${str(r.First_Name)} ${str(r.Last_Name)}`.trim() || str(r.Full_Name),
    email: str(r.Email),
    phone: str(r.Phone) || str(r.Mobile),
    currentEmployer: str(r.Current_Employer),
    currentJobTitle: str(r.Current_Job_Title),
    experienceYears: str(r.Experience_in_Years),
    candidateStatus: str(r.Candidate_Status),
    source: str(r.Source),
    createdTime: str(r.Created_Time),
    city: str(r.City),
    skill: str(r.Skill_Set),
  };
}

function mapJobOpening(r: Record<string, unknown>): RecruitJobOpening {
  return {
    id: str(r.id),
    postingTitle: str(r.Posting_Title),
    department: str(r.Department),
    numberOfPositions: str(r.Number_of_Positions),
    jobStatus: str(r.Job_Opening_Status),
    dateOpened: str(r.Date_Opened),
    targetDate: str(r.Target_Date),
    jobType: str(r.Job_Type),
    industry: str(r.Industry),
    salary: str(r.Salary),
    city: str(r.City),
    assignedRecruiter: str(r.Assigned_Recruiter),
  };
}

function mapInterview(r: Record<string, unknown>): RecruitInterview {
  const interviewers = Array.isArray(r.Interviewer)
    ? (r.Interviewer as Record<string, unknown>[]).map((i) => str(i.name) || str(i.Name)).filter(Boolean).join(", ")
    : str(r.Interviewer);
  return {
    id: str(r.id),
    interviewName: str(r.Interview_Name),
    candidateName: str(r.Candidate_Name),
    interviewDate: str(r.Interview_Date),
    from: str(r.from),
    to: str(r.to),
    interviewers,
    location: str(r.Location),
    scheduleComments: str(r.Schedule_Comments),
    status: str(r.Interview_Status) || str(r.Status),
    jobOpeningName: str(r.Job_Opening_Name),
  };
}

function detectRecruitModule(query: string): RecruitResultType {
  const lower = query.toLowerCase();

  if (lower.includes("pipeline") || lower.includes("hiring overview") || lower.includes("recruitment summary")) return "pipeline";
  if (lower.includes("interview") || lower.includes("schedule")) return "interviews";
  if (lower.includes("job") || lower.includes("opening") || lower.includes("position") || lower.includes("vacancy") || lower.includes("posting") || lower.includes("hiring for") || lower.includes("role")) return "job_openings";
  return "candidates";
}

function moduleTypeToApiModule(moduleType: RecruitResultType): string {
  switch (moduleType) {
    case "candidates": return "Candidates";
    case "job_openings": return "Job_Openings";
    case "interviews": return "Interviews";
    default: return "Candidates";
  }
}

async function fetchRecruitModuleRaw(
  accessToken: string,
  module: string,
  recruitBase: string,
): Promise<Record<string, unknown>[]> {
  try {
    const response = await axios.get(`${recruitBase}/${module}`, {
      params: { per_page: DEFAULT_LIMIT },
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });

    return response.data?.data || [];
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && [401, 403].includes(err.response?.status || 0)) {
      throw new ZohoPermissionError(
        "Zoho Recruit access denied — your Zoho connection may not include Recruit permissions.",
        err.response?.status || 401,
      );
    }
    if (axios.isAxiosError(err) && err.response?.status === 204) {
      return [];
    }
    throw err;
  }
}

async function searchRecruitByWord(
  accessToken: string,
  module: string,
  word: string,
  recruitBase: string,
): Promise<Record<string, unknown>[] | null> {
  try {
    console.log(`[ZohoRecruit] Searching ${module} for word "${word}"`);
    const response = await axios.get(`${recruitBase}/${module}/search`, {
      params: { word, per_page: DEFAULT_LIMIT },
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });
    const records = response.data?.data || [];
    console.log(`[ZohoRecruit] Search ${module} for "${word}" returned ${records.length} records`);
    return records;
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status || 0;
      if ([401, 403].includes(status)) {
        throw new ZohoPermissionError(
          "Zoho Recruit access denied — your Zoho connection may not include Recruit permissions.",
          status,
        );
      }
      if (status === 204) {
        console.log(`[ZohoRecruit] Search ${module} for "${word}" returned no results (204)`);
        return [];
      }
      console.error(`[ZohoRecruit] Search ${module} failed (${status}):`, JSON.stringify(err.response?.data || {}).substring(0, 200));
    }
    return null;
  }
}

async function searchRecruitByCriteria(
  accessToken: string,
  module: string,
  criteria: string,
  recruitBase: string,
): Promise<Record<string, unknown>[] | null> {
  try {
    console.log(`[ZohoRecruit] Criteria search ${module}: ${criteria}`);
    const response = await axios.get(`${recruitBase}/${module}/search`, {
      params: { criteria, per_page: DEFAULT_LIMIT },
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });
    const records = response.data?.data || [];
    console.log(`[ZohoRecruit] Criteria search ${module} returned ${records.length} records`);
    return records;
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status || 0;
      if ([401, 403].includes(status)) {
        throw new ZohoPermissionError(
          "Zoho Recruit access denied — your Zoho connection may not include Recruit permissions.",
          status,
        );
      }
      if (status === 204) {
        console.log(`[ZohoRecruit] Criteria search ${module} returned no results (204)`);
        return [];
      }
      console.error(`[ZohoRecruit] Criteria search ${module} failed (${status}):`, JSON.stringify(err.response?.data || {}).substring(0, 200));
    }
    return null;
  }
}

function filterByDateClientSide(
  records: Record<string, unknown>[],
  dateField: string,
  dateStart: string,
  dateEnd: string,
): Record<string, unknown>[] {
  const start = new Date(dateStart);
  const end = new Date(dateEnd + "T23:59:59");
  return records.filter((r) => {
    const val = r[dateField];
    if (!val || typeof val !== "string") return false;
    const d = new Date(val);
    return d >= start && d <= end;
  });
}

function filterByStatusClientSide(
  records: Record<string, unknown>[],
  statusField: string,
  statusFilter: string,
): Record<string, unknown>[] {
  const lowerFilter = statusFilter.toLowerCase();
  return records.filter((r) => {
    const val = str(r[statusField]);
    return val.toLowerCase().includes(lowerFilter);
  });
}

const ENTITY_SEARCH_FIELDS: Record<string, string[]> = {
  Candidates: ["First_Name", "Last_Name", "Full_Name", "Email", "Current_Employer", "Current_Job_Title", "Skill_Set"],
  Job_Openings: ["Posting_Title", "Department", "Job_Type", "Industry"],
  Interviews: ["Interview_Name", "Candidate_Name", "Job_Opening_Name"],
};

function filterByEntityClientSide(
  records: Record<string, unknown>[],
  entity: string,
  apiModule: string,
): Record<string, unknown>[] {
  const lowerEntity = entity.toLowerCase();
  const fields = ENTITY_SEARCH_FIELDS[apiModule] || [];
  return records.filter((r) => {
    for (const field of fields) {
      const val = str(r[field]).toLowerCase();
      if (val.includes(lowerEntity)) return true;
    }
    return false;
  });
}

function buildResult(
  moduleType: RecruitResultType,
  records: Record<string, unknown>[],
  context?: Partial<ZohoRecruitResult>,
): ZohoRecruitResult {
  const base: ZohoRecruitResult = {
    type: moduleType,
    total: records.length,
    source: "live",
    ...context,
  };

  switch (moduleType) {
    case "candidates":
      base.candidates = records.map(mapCandidate);
      break;
    case "job_openings":
      base.jobOpenings = records.map(mapJobOpening);
      break;
    case "interviews":
      base.interviews = records.map(mapInterview);
      break;
  }

  return base;
}

export async function queryZohoRecruit(
  query: string,
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  domain?: string,
  options?: RecruitSearchOptions,
): Promise<ZohoRecruitResult> {
  const accessToken = await getZohoAccessToken(clientId, clientSecret, refreshToken, domain);
  const recruitBase = getRecruitBaseUrl(domain || "https://accounts.zoho.com");

  const moduleParam = options?.module?.toLowerCase();
  const moduleType: RecruitResultType = moduleParam === "candidates" || moduleParam === "job_openings" || moduleParam === "interviews" || moduleParam === "pipeline"
    ? moduleParam
    : detectRecruitModule(query);

  if (moduleType === "pipeline") {
    const [candidateRaw, jobRaw] = await Promise.all([
      fetchRecruitModuleRaw(accessToken, "Candidates", recruitBase),
      fetchRecruitModuleRaw(accessToken, "Job_Openings", recruitBase),
    ]);
    return {
      type: "pipeline",
      candidates: candidateRaw.map(mapCandidate),
      jobOpenings: jobRaw.map(mapJobOpening),
      total: candidateRaw.length + jobRaw.length,
      source: "live",
    };
  }

  const apiModule = moduleTypeToApiModule(moduleType);
  const searchEntity = options?.searchEntity || undefined;
  const statusFilter = options?.statusFilter || undefined;
  const rawDateField = options?.dateField || "";
  const dateField = VALID_DATE_FIELDS.has(rawDateField) ? rawDateField : DEFAULT_DATE_FIELD_MAP[apiModule] || "Created_Time";
  const dateStart = options?.dateRangeStart || null;
  const dateEnd = options?.dateRangeEnd || null;
  const hasDateFilter = !!(dateStart && dateEnd);
  const wantRecruiterFilter = options?.recruiterFilter === "me";
  const statusField = STATUS_FIELD_MAP[apiModule] || "Status";

  const filterContext: Partial<ZohoRecruitResult> = {};
  if (searchEntity) filterContext.searchEntity = searchEntity;
  if (statusFilter) filterContext.statusFilter = statusFilter;
  if (hasDateFilter) {
    filterContext.dateRangeStart = dateStart!;
    filterContext.dateRangeEnd = dateEnd!;
    filterContext.dateField = dateField;
  }

  console.log(`[ZohoRecruit] Module: ${apiModule}, searchEntity: ${searchEntity || "(none)"}, statusFilter: ${statusFilter || "(none)"}, recruiterFilter: ${wantRecruiterFilter}, dateFilter: ${hasDateFilter ? `${dateField} ${dateStart}→${dateEnd}` : "none"}`);

  if (searchEntity) {
    const rawResults = await searchRecruitByWord(accessToken, apiModule, searchEntity, recruitBase);

    if (rawResults !== null) {
      let filtered = rawResults;

      if (statusFilter) {
        filtered = filterByStatusClientSide(filtered, statusField, statusFilter);
        console.log(`[ZohoRecruit] Status filter "${statusFilter}": ${rawResults.length} → ${filtered.length}`);
      }

      if (hasDateFilter) {
        const beforeCount = filtered.length;
        filtered = filterByDateClientSide(filtered, dateField, dateStart!, dateEnd!);
        console.log(`[ZohoRecruit] Date filter: ${beforeCount} → ${filtered.length} (${dateField} ${dateStart}→${dateEnd})`);
      }

      if (wantRecruiterFilter) {
        const recruiterResults = await searchRecruitByCriteria(
          accessToken, apiModule, "(Created_By:equals:${CURRENTUSER})", recruitBase,
        );
        if (recruiterResults !== null) {
          const recruiterIds = new Set(recruiterResults.map((r) => String(r.id || "")));
          const beforeCount = filtered.length;
          filtered = filtered.filter((r) => recruiterIds.has(String(r.id || "")));
          console.log(`[ZohoRecruit] Recruiter intersection: ${beforeCount} → ${filtered.length}`);
        } else {
          console.log(`[ZohoRecruit] Recruiter criteria unsupported — returning empty to avoid unfiltered data`);
          return buildResult(moduleType, [], filterContext);
        }
      }

      return buildResult(moduleType, filtered, filterContext);
    }

    console.log(`[ZohoRecruit] Search for "${searchEntity}" returned null, falling back to fetch + client-side entity filter`);
  }

  if (wantRecruiterFilter || statusFilter) {
    const criteriaparts: string[] = [];
    if (wantRecruiterFilter) criteriaparts.push("(Created_By:equals:${CURRENTUSER})");
    if (statusFilter) criteriaparts.push(`(${statusField}:equals:${statusFilter})`);

    if (criteriaparts.length > 0) {
      const criteria = criteriaparts.join("and");
      console.log(`[ZohoRecruit] Criteria search: ${criteria}`);
      const criteriaResults = await searchRecruitByCriteria(accessToken, apiModule, criteria, recruitBase);

      if (criteriaResults !== null) {
        let filtered = criteriaResults;
        if (searchEntity) {
          filtered = filterByEntityClientSide(filtered, searchEntity, apiModule);
          console.log(`[ZohoRecruit] Entity filter on criteria results: "${searchEntity}" → ${filtered.length}`);
        }
        if (hasDateFilter) {
          filtered = filterByDateClientSide(filtered, dateField, dateStart!, dateEnd!);
          console.log(`[ZohoRecruit] Date filter on criteria results: → ${filtered.length}`);
        }
        return buildResult(moduleType, filtered, filterContext);
      }

      if (wantRecruiterFilter) {
        console.log(`[ZohoRecruit] Recruiter criteria not supported — returning empty to avoid unfiltered data`);
        return buildResult(moduleType, [], filterContext);
      }

      console.log(`[ZohoRecruit] Criteria search failed — falling back to fetch + client-side filter`);
    }
  }

  const raw = await fetchRecruitModuleRaw(accessToken, apiModule, recruitBase);
  let filtered = raw;

  if (searchEntity) {
    filtered = filterByEntityClientSide(filtered, searchEntity, apiModule);
    console.log(`[ZohoRecruit] Client-side entity filter: "${searchEntity}" ${raw.length} → ${filtered.length}`);
  }

  if (statusFilter) {
    const beforeCount = filtered.length;
    filtered = filterByStatusClientSide(filtered, statusField, statusFilter);
    console.log(`[ZohoRecruit] Client-side status filter: ${beforeCount} → ${filtered.length}`);
  }

  if (hasDateFilter) {
    const beforeCount = filtered.length;
    filtered = filterByDateClientSide(filtered, dateField, dateStart!, dateEnd!);
    console.log(`[ZohoRecruit] Client-side date filter: ${beforeCount} → ${filtered.length}`);
  }

  return buildResult(moduleType, filtered, filterContext);
}

export function formatRecruitResult(result: ZohoRecruitResult, query: string): string {
  const q = `\n\nQuery: "${query}"`;

  const contextParts: string[] = [];
  if (result.searchEntity) contextParts.push(`Search: "${result.searchEntity}"`);
  if (result.statusFilter) contextParts.push(`Status filter: ${result.statusFilter}`);
  if (result.dateRangeStart && result.dateRangeEnd) {
    contextParts.push(`Date filter: ${result.dateField || "Created_Time"} from ${result.dateRangeStart} to ${result.dateRangeEnd}`);
  }
  const filterNote = contextParts.length > 0 ? `\n${contextParts.join(" | ")}` : "";

  if (result.type === "pipeline" && result.candidates && result.jobOpenings) {
    const sections: string[] = [];

    if (result.jobOpenings.length > 0) {
      const jobLines = result.jobOpenings.map(
        (j) => `  • ${j.postingTitle} — ${j.department || "N/A"} [${j.jobStatus}] Positions: ${j.numberOfPositions || "1"}${j.assignedRecruiter ? ` | Recruiter: ${j.assignedRecruiter}` : ""}`,
      );
      sections.push(`Open Positions (${result.jobOpenings.length}):\n${jobLines.join("\n")}`);
    }

    if (result.candidates.length > 0) {
      const statusCounts: Record<string, number> = {};
      for (const c of result.candidates) {
        const status = c.candidateStatus || "Unknown";
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      }
      const statusLines = Object.entries(statusCounts).map(([s, n]) => `  • ${s}: ${n}`);
      sections.push(`Candidates (${result.candidates.length} total) by Status:\n${statusLines.join("\n")}`);
    }

    if (sections.length === 0) return `No hiring pipeline data found.${q}`;
    return `Zoho Recruit — Hiring Pipeline:\n\n${sections.join("\n\n")}${q}`;
  }

  if (result.type === "candidates" && result.candidates) {
    if (result.candidates.length === 0) return `No candidates found.${filterNote}${q}`;
    const lines = result.candidates.map(
      (c) => `• ${c.name} — ${c.currentJobTitle || "N/A"} at ${c.currentEmployer || "N/A"} (${c.email}${c.phone ? ` | ${c.phone}` : ""}) [${c.candidateStatus}]${c.experienceYears ? ` ${c.experienceYears}yr exp` : ""}${c.skill ? ` | Skills: ${c.skill}` : ""}${c.city ? ` | ${c.city}` : ""} Source: ${c.source || "N/A"}`,
    );
    return `Zoho Recruit — Candidates (${result.total} found):\n${lines.join("\n")}${filterNote}${q}`;
  }

  if (result.type === "job_openings" && result.jobOpenings) {
    if (result.jobOpenings.length === 0) return `No job openings found.${filterNote}${q}`;
    const lines = result.jobOpenings.map(
      (j) => `• ${j.postingTitle} — ${j.department || "N/A"} [${j.jobStatus}] Positions: ${j.numberOfPositions || "1"} Type: ${j.jobType || "N/A"}${j.dateOpened ? ` | Opened: ${j.dateOpened}` : ""}${j.targetDate ? ` | Target: ${j.targetDate}` : ""}${j.salary ? ` | Salary: ${j.salary}` : ""}${j.city ? ` | ${j.city}` : ""}${j.assignedRecruiter ? ` | Recruiter: ${j.assignedRecruiter}` : ""}`,
    );
    return `Zoho Recruit — Job Openings (${result.total} found):\n${lines.join("\n")}${filterNote}${q}`;
  }

  if (result.type === "interviews" && result.interviews) {
    if (result.interviews.length === 0) return `No interviews found.${filterNote}${q}`;
    const lines = result.interviews.map(
      (i) => `• ${i.interviewName || "Interview"} — Candidate: ${i.candidateName || "N/A"} [${i.status || "Scheduled"}] Date: ${i.interviewDate || "TBD"} ${i.from && i.to ? `${i.from}-${i.to}` : ""}${i.interviewers ? ` | Interviewers: ${i.interviewers}` : ""}${i.location ? ` | Location: ${i.location}` : ""}${i.jobOpeningName ? ` | Job: ${i.jobOpeningName}` : ""}`,
    );
    return `Zoho Recruit — Interviews (${result.total} found):\n${lines.join("\n")}${filterNote}${q}`;
  }

  return `No Zoho Recruit data found.${q}`;
}
