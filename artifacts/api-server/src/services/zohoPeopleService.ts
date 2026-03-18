import axios from "axios";
import { getZohoAccessToken } from "./zohoTokenManager";

export interface ZohoEmployee {
  id: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  status: string;
}

export interface ZohoLeaveRequest {
  id: string;
  employee: string;
  leaveType: string;
  from: string;
  to: string;
  status: string;
}

export interface ZohoPeopleResult {
  type: "employees" | "leave" | "attendance";
  employees?: ZohoEmployee[];
  leaveRequests?: ZohoLeaveRequest[];
  total: number;
  source: "live" | "error";
}

const PEOPLE_BASE = "https://people.zoho.com";

async function fetchEmployees(accessToken: string): Promise<ZohoEmployee[]> {
  const response = await axios.get(`${PEOPLE_BASE}/people/api/forms/employee/getRecords`, {
    params: { sIndex: 1, limit: 20 },
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });

  const data = response.data;
  if (!data || data.response?.errors) {
    throw new Error(data.response?.errors?.message || "Failed to fetch employees");
  }

  const records = Array.isArray(data) ? data : [];
  return records.map((row: Record<string, string[]>) => {
    const rec = Object.values(row)[0]?.[0] || {};
    return {
      id: (rec as Record<string, string>).Empleado_ID || (rec as Record<string, string>).EmployeeID || "",
      name: `${(rec as Record<string, string>).FirstName || ""} ${(rec as Record<string, string>).LastName || ""}`.trim(),
      email: (rec as Record<string, string>).EmailID || (rec as Record<string, string>).Work_Email || "",
      department: (rec as Record<string, string>).Department || "",
      designation: (rec as Record<string, string>).Designation || "",
      status: (rec as Record<string, string>).Employeestatus || "Active",
    };
  });
}

async function fetchLeaveRequests(accessToken: string): Promise<ZohoLeaveRequest[]> {
  const response = await axios.get(`${PEOPLE_BASE}/people/api/forms/leave/getRecords`, {
    params: { sIndex: 1, limit: 20 },
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });

  const data = response.data;
  if (!data || data.response?.errors) {
    throw new Error(data.response?.errors?.message || "Failed to fetch leave requests");
  }

  const records = Array.isArray(data) ? data : [];
  return records.map((row: Record<string, string[]>) => {
    const rec = Object.values(row)[0]?.[0] || {};
    return {
      id: (rec as Record<string, string>).Leavetype_ID || "",
      employee: (rec as Record<string, string>).Employee_Name || (rec as Record<string, string>).EmployeeName || "",
      leaveType: (rec as Record<string, string>).Leavetype || (rec as Record<string, string>).LeaveType || "",
      from: (rec as Record<string, string>).From || "",
      to: (rec as Record<string, string>).To || "",
      status: (rec as Record<string, string>).ApprovalStatus || "Pending",
    };
  });
}

async function fetchAttendance(accessToken: string): Promise<Record<string, string>[]> {
  const today = new Date().toISOString().split("T")[0];
  const response = await axios.get(`${PEOPLE_BASE}/people/api/attendance`, {
    params: { sdate: today, edate: today, limit: 20 },
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });

  const data = response.data;
  if (!data || data.response?.errors) {
    throw new Error(data.response?.errors?.message || "Failed to fetch attendance");
  }

  const records = Array.isArray(data) ? data : [];
  return records;
}

export async function queryZohoPeople(
  query: string,
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  domain?: string,
): Promise<ZohoPeopleResult> {
  const accessToken = await getZohoAccessToken(clientId, clientSecret, refreshToken, domain);
  const lower = query.toLowerCase();

  if (lower.includes("leave") || lower.includes("time off") || lower.includes("vacation") || lower.includes("pto")) {
    const leaveRequests = await fetchLeaveRequests(accessToken);
    return { type: "leave", leaveRequests, total: leaveRequests.length, source: "live" };
  }

  if (lower.includes("attendance") || lower.includes("check-in") || lower.includes("checkin")) {
    const records = await fetchAttendance(accessToken);
    return { type: "attendance", total: records.length, source: "live" };
  }

  const employees = await fetchEmployees(accessToken);
  return { type: "employees", employees, total: employees.length, source: "live" };
}

export function formatPeopleResult(result: ZohoPeopleResult, query: string): string {
  if (result.type === "leave" && result.leaveRequests) {
    if (result.leaveRequests.length === 0) {
      return `No leave requests found.\n\nQuery: "${query}"`;
    }
    const lines = result.leaveRequests.map(
      (l) => `• ${l.employee} — ${l.leaveType} (${l.from} to ${l.to}) [${l.status}]`,
    );
    return `Zoho People — Leave Requests (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
  }

  if (result.type === "attendance") {
    if (result.total === 0) {
      return `No attendance records found for today.\n\nQuery: "${query}"`;
    }
    return `Zoho People — Attendance (${result.total} records found for today).\n\nQuery: "${query}"`;
  }

  if (result.employees) {
    if (result.employees.length === 0) {
      return `No employees found.\n\nQuery: "${query}"`;
    }
    const lines = result.employees.map(
      (e) => `• ${e.name} — ${e.designation}, ${e.department} (${e.email}) [${e.status}]`,
    );
    return `Zoho People — Employees (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
  }

  return `No Zoho People data found.\n\nQuery: "${query}"`;
}
