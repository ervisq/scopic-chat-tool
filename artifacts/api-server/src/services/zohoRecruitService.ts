import axios from "axios";
import { getZohoAccessToken } from "./zohoTokenManager";

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

export type RecruitResultType = "candidates" | "job_openings" | "interviews";

export interface ZohoRecruitResult {
  type: RecruitResultType;
  candidates?: RecruitCandidate[];
  jobOpenings?: RecruitJobOpening[];
  interviews?: RecruitInterview[];
  total: number;
  source: "live" | "error";
}

const RECRUIT_BASE = "https://recruit.zoho.com/recruit/v2";
const DEFAULT_LIMIT = 200;

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

  if (lower.includes("interview") || lower.includes("schedule")) return "interviews";
  if (lower.includes("job") || lower.includes("opening") || lower.includes("position") || lower.includes("vacancy") || lower.includes("posting") || lower.includes("hiring for")) return "job_openings";
  return "candidates";
}

async function fetchRecruitModule<T>(
  accessToken: string,
  module: string,
  mapper: (record: Record<string, unknown>) => T,
): Promise<T[]> {
  const response = await axios.get(`${RECRUIT_BASE}/${module}`, {
    params: { per_page: DEFAULT_LIMIT },
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });

  const records = response.data?.data || [];
  return records.map(mapper);
}

export async function queryZohoRecruit(
  query: string,
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  domain?: string,
): Promise<ZohoRecruitResult> {
  const accessToken = await getZohoAccessToken(clientId, clientSecret, refreshToken, domain);
  const moduleType = detectRecruitModule(query);

  switch (moduleType) {
    case "candidates": {
      const candidates = await fetchRecruitModule(accessToken, "Candidates", mapCandidate);
      return { type: "candidates", candidates, total: candidates.length, source: "live" };
    }
    case "job_openings": {
      const jobOpenings = await fetchRecruitModule(accessToken, "Job_Openings", mapJobOpening);
      return { type: "job_openings", jobOpenings, total: jobOpenings.length, source: "live" };
    }
    case "interviews": {
      const interviews = await fetchRecruitModule(accessToken, "Interviews", mapInterview);
      return { type: "interviews", interviews, total: interviews.length, source: "live" };
    }
  }
}

export function formatRecruitResult(result: ZohoRecruitResult, query: string): string {
  const q = `\n\nQuery: "${query}"`;

  if (result.type === "candidates" && result.candidates) {
    if (result.candidates.length === 0) return `No candidates found.${q}`;
    const lines = result.candidates.map(
      (c) => `• ${c.name} — ${c.currentJobTitle || "N/A"} at ${c.currentEmployer || "N/A"} (${c.email}${c.phone ? ` | ${c.phone}` : ""}) [${c.candidateStatus}]${c.experienceYears ? ` ${c.experienceYears}yr exp` : ""}${c.skill ? ` | Skills: ${c.skill}` : ""}${c.city ? ` | ${c.city}` : ""} Source: ${c.source || "N/A"}`,
    );
    return `Zoho Recruit — Candidates (${result.total} found):\n${lines.join("\n")}${q}`;
  }

  if (result.type === "job_openings" && result.jobOpenings) {
    if (result.jobOpenings.length === 0) return `No job openings found.${q}`;
    const lines = result.jobOpenings.map(
      (j) => `• ${j.postingTitle} — ${j.department || "N/A"} [${j.jobStatus}] Positions: ${j.numberOfPositions || "1"} Type: ${j.jobType || "N/A"}${j.dateOpened ? ` | Opened: ${j.dateOpened}` : ""}${j.targetDate ? ` | Target: ${j.targetDate}` : ""}${j.salary ? ` | Salary: ${j.salary}` : ""}${j.city ? ` | ${j.city}` : ""}${j.assignedRecruiter ? ` | Recruiter: ${j.assignedRecruiter}` : ""}`,
    );
    return `Zoho Recruit — Job Openings (${result.total} found):\n${lines.join("\n")}${q}`;
  }

  if (result.type === "interviews" && result.interviews) {
    if (result.interviews.length === 0) return `No interviews found.${q}`;
    const lines = result.interviews.map(
      (i) => `• ${i.interviewName || "Interview"} — Candidate: ${i.candidateName || "N/A"} [${i.status || "Scheduled"}] Date: ${i.interviewDate || "TBD"} ${i.from && i.to ? `${i.from}-${i.to}` : ""}${i.interviewers ? ` | Interviewers: ${i.interviewers}` : ""}${i.location ? ` | Location: ${i.location}` : ""}${i.jobOpeningName ? ` | Job: ${i.jobOpeningName}` : ""}`,
    );
    return `Zoho Recruit — Interviews (${result.total} found):\n${lines.join("\n")}${q}`;
  }

  return `No Zoho Recruit data found.${q}`;
}
