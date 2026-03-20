import axios from "axios";
import { getZohoAccessToken } from "./zohoTokenManager";

export interface ZohoEmployee {
  id: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  status: string;
  dateOfJoining: string;
  reportingTo: string;
  location: string;
  employeeId: string;
  phone: string;
}

export interface ZohoLeaveRequest {
  id: string;
  employee: string;
  leaveType: string;
  from: string;
  to: string;
  status: string;
  dayCount: string;
  reason: string;
}

export interface ZohoDepartment {
  id: string;
  name: string;
  parentDepartment: string;
}

export interface ZohoAttendanceRecord {
  employee: string;
  date: string;
  checkIn: string;
  checkOut: string;
  totalHours: string;
  status: string;
}

export interface ZohoTimeLog {
  id: string;
  employee: string;
  project: string;
  taskName: string;
  hours: string;
  date: string;
  description: string;
}

export interface ZohoPeopleResult {
  type: "employees" | "leave" | "attendance" | "departments" | "timesheets" | "employee_detail";
  employees?: ZohoEmployee[];
  leaveRequests?: ZohoLeaveRequest[];
  attendanceRecords?: ZohoAttendanceRecord[];
  departments?: ZohoDepartment[];
  timeLogs?: ZohoTimeLog[];
  total: number;
  source: "live" | "error";
}

const PEOPLE_BASE = "https://people.zoho.com";
const DEFAULT_LIMIT = 200;

async function fetchEmployees(accessToken: string): Promise<ZohoEmployee[]> {
  const response = await axios.get(`${PEOPLE_BASE}/people/api/forms/employee/getRecords`, {
    params: { sIndex: 1, limit: DEFAULT_LIMIT },
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });

  const data = response.data;
  if (!data || data.response?.errors) {
    throw new Error(data.response?.errors?.message || "Failed to fetch employees");
  }

  const records = Array.isArray(data) ? data : [];
  return records.map((row: Record<string, Record<string, string>[]>) => {
    const rec = (Object.values(row)[0]?.[0] || {}) as Record<string, string>;
    return {
      id: rec.Empleado_ID || rec.EmployeeID || rec.recordid || "",
      employeeId: rec.EmployeeID || rec.Empleado_ID || "",
      name: `${rec.FirstName || rec.First_Name || ""} ${rec.LastName || rec.Last_Name || ""}`.trim(),
      email: rec.EmailID || rec.Work_Email || rec.Email || "",
      department: rec.Department || "",
      designation: rec.Designation || rec.Title || "",
      status: rec.Employeestatus || rec.Employee_Status || "Active",
      dateOfJoining: rec.Dateofjoining || rec.Date_of_joining || "",
      reportingTo: rec.Reporting_To || rec.ReportingTo || "",
      location: rec.Location || rec.Work_location || "",
      phone: rec.Work_phone || rec.Mobile || rec.Phone || "",
    };
  });
}

async function searchEmployee(accessToken: string, searchTerm: string): Promise<ZohoEmployee[]> {
  const allEmployees = await fetchEmployees(accessToken);
  const lower = searchTerm.toLowerCase();
  return allEmployees.filter(
    (e) =>
      e.name.toLowerCase().includes(lower) ||
      e.email.toLowerCase().includes(lower) ||
      e.department.toLowerCase().includes(lower) ||
      e.designation.toLowerCase().includes(lower),
  );
}

async function fetchLeaveRequests(accessToken: string): Promise<ZohoLeaveRequest[]> {
  const response = await axios.get(`${PEOPLE_BASE}/people/api/forms/leave/getRecords`, {
    params: { sIndex: 1, limit: DEFAULT_LIMIT },
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });

  const data = response.data;
  if (!data || data.response?.errors) {
    throw new Error(data.response?.errors?.message || "Failed to fetch leave requests");
  }

  const records = Array.isArray(data) ? data : [];
  return records.map((row: Record<string, Record<string, string>[]>) => {
    const rec = (Object.values(row)[0]?.[0] || {}) as Record<string, string>;
    return {
      id: rec.Leavetype_ID || rec.recordid || "",
      employee: rec.Employee_Name || rec.EmployeeName || rec.Employee || "",
      leaveType: rec.Leavetype || rec.LeaveType || rec.Leave_Type || "",
      from: rec.From || rec.Start_Date || "",
      to: rec.To || rec.End_Date || "",
      status: rec.ApprovalStatus || rec.Approval_Status || "Pending",
      dayCount: rec.Daystaken || rec.Days || rec.Day_Count || "",
      reason: rec.Reason || rec.Description || "",
    };
  });
}

async function fetchAttendance(accessToken: string, dateRange?: { start: string; end: string }): Promise<ZohoAttendanceRecord[]> {
  const today = new Date().toISOString().split("T")[0];
  const sdate = dateRange?.start || today;
  const edate = dateRange?.end || today;

  const response = await axios.get(`${PEOPLE_BASE}/people/api/attendance`, {
    params: { sdate, edate, limit: DEFAULT_LIMIT },
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });

  const data = response.data;
  if (!data || data.response?.errors) {
    throw new Error(data.response?.errors?.message || "Failed to fetch attendance");
  }

  const records = Array.isArray(data) ? data : [];
  return records.map((rec: Record<string, string>) => ({
    employee: rec.employeeName || rec.Employee_Name || rec.firstName || "",
    date: rec.date || rec.Date || sdate,
    checkIn: rec.firstIn || rec.CheckIn || rec.check_in || "",
    checkOut: rec.lastOut || rec.CheckOut || rec.check_out || "",
    totalHours: rec.totalHrs || rec.Total_Hours || "",
    status: rec.status || rec.Status || "",
  }));
}

async function fetchDepartments(accessToken: string): Promise<ZohoDepartment[]> {
  const response = await axios.get(`${PEOPLE_BASE}/people/api/forms/department/getRecords`, {
    params: { sIndex: 1, limit: DEFAULT_LIMIT },
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });

  const data = response.data;
  if (!data || data.response?.errors) {
    throw new Error(data.response?.errors?.message || "Failed to fetch departments");
  }

  const records = Array.isArray(data) ? data : [];
  return records.map((row: Record<string, Record<string, string>[]>) => {
    const rec = (Object.values(row)[0]?.[0] || {}) as Record<string, string>;
    return {
      id: rec.recordid || rec.Department_ID || "",
      name: rec.Department || rec.Department_Name || rec.Name || "",
      parentDepartment: rec.ParentDepartment || rec.Parent_Department || "",
    };
  });
}

async function fetchTimesheets(accessToken: string): Promise<ZohoTimeLog[]> {
  const response = await axios.get(`${PEOPLE_BASE}/people/api/forms/timesheet/getRecords`, {
    params: { sIndex: 1, limit: DEFAULT_LIMIT },
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });

  const data = response.data;
  if (!data || data.response?.errors) {
    throw new Error(data.response?.errors?.message || "Failed to fetch timesheets");
  }

  const records = Array.isArray(data) ? data : [];
  return records.map((row: Record<string, Record<string, string>[]>) => {
    const rec = (Object.values(row)[0]?.[0] || {}) as Record<string, string>;
    return {
      id: rec.recordid || "",
      employee: rec.Employee || rec.Employee_Name || rec.EmployeeName || "",
      project: rec.Project || rec.Project_Name || "",
      taskName: rec.Task || rec.TaskName || rec.Work_Item || "",
      hours: rec.Hours || rec.Total_Hours || rec.Duration || "",
      date: rec.Date || rec.Work_Date || "",
      description: rec.Description || rec.Notes || "",
    };
  });
}

function parseDateRange(query: string): { start: string; end: string } | undefined {
  const today = new Date();
  const lower = query.toLowerCase();

  if (lower.includes("this week")) {
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    return { start: monday.toISOString().split("T")[0], end: today.toISOString().split("T")[0] };
  }

  if (lower.includes("last week")) {
    const dayOfWeek = today.getDay();
    const lastMonday = new Date(today);
    lastMonday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) - 7);
    const lastFriday = new Date(lastMonday);
    lastFriday.setDate(lastMonday.getDate() + 4);
    return { start: lastMonday.toISOString().split("T")[0], end: lastFriday.toISOString().split("T")[0] };
  }

  if (lower.includes("this month")) {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: firstDay.toISOString().split("T")[0], end: today.toISOString().split("T")[0] };
  }

  if (lower.includes("last month")) {
    const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
    return { start: firstDay.toISOString().split("T")[0], end: lastDay.toISOString().split("T")[0] };
  }

  return undefined;
}

function extractSearchTerm(query: string): string | null {
  const patterns = [
    /(?:find|search|look up|lookup|info about|details (?:of|for|about)|who is|about)\s+(.+)/i,
    /(?:employee|person|staff|member)\s+(?:named?|called?)\s+(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match) return match[1].trim().replace(/[?.]$/, "");
  }
  return null;
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

  if (lower.includes("department")) {
    try {
      const departments = await fetchDepartments(accessToken);
      return { type: "departments", departments, total: departments.length, source: "live" };
    } catch {
      const employees = await fetchEmployees(accessToken);
      const deptSet = new Map<string, ZohoDepartment>();
      for (const e of employees) {
        if (e.department && !deptSet.has(e.department)) {
          deptSet.set(e.department, { id: "", name: e.department, parentDepartment: "" });
        }
      }
      const departments = Array.from(deptSet.values());
      return { type: "departments", departments, total: departments.length, source: "live" };
    }
  }

  if (lower.includes("timesheet") || lower.includes("time log") || lower.includes("time track") || lower.includes("hours logged") || lower.includes("work hours")) {
    try {
      const timeLogs = await fetchTimesheets(accessToken);
      return { type: "timesheets", timeLogs, total: timeLogs.length, source: "live" };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Timesheets not available: ${msg}. This form may not be enabled in your Zoho People account.`);
    }
  }

  if (lower.includes("leave") || lower.includes("time off") || lower.includes("vacation") || lower.includes("pto") || lower.includes("absence") || lower.includes("sick day") || lower.includes("holiday")) {
    const leaveRequests = await fetchLeaveRequests(accessToken);
    return { type: "leave", leaveRequests, total: leaveRequests.length, source: "live" };
  }

  if (lower.includes("attendance") || lower.includes("check-in") || lower.includes("checkin") || lower.includes("check in") || lower.includes("punch") || lower.includes("clock in") || lower.includes("clock out") || lower.includes("present today")) {
    const dateRange = parseDateRange(query);
    const attendanceRecords = await fetchAttendance(accessToken, dateRange);
    return { type: "attendance", attendanceRecords, total: attendanceRecords.length, source: "live" };
  }

  const searchTerm = extractSearchTerm(query);
  if (searchTerm) {
    const employees = await searchEmployee(accessToken, searchTerm);
    return { type: "employee_detail", employees, total: employees.length, source: "live" };
  }

  const employees = await fetchEmployees(accessToken);
  return { type: "employees", employees, total: employees.length, source: "live" };
}

export function formatPeopleResult(result: ZohoPeopleResult, query: string): string {
  if (result.type === "departments" && result.departments) {
    if (result.departments.length === 0) return `No departments found.\n\nQuery: "${query}"`;
    const lines = result.departments.map(
      (d) => `• ${d.name}${d.parentDepartment ? ` (under ${d.parentDepartment})` : ""}`,
    );
    return `Zoho People — Departments (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
  }

  if (result.type === "timesheets" && result.timeLogs) {
    if (result.timeLogs.length === 0) return `No timesheet entries found.\n\nQuery: "${query}"`;
    const lines = result.timeLogs.map(
      (t) => `• ${t.employee} — ${t.project || "No project"}: ${t.taskName || "General"} (${t.hours} hrs on ${t.date})${t.description ? ` — ${t.description}` : ""}`,
    );
    return `Zoho People — Timesheets (${result.total} entries):\n${lines.join("\n")}\n\nQuery: "${query}"`;
  }

  if (result.type === "leave" && result.leaveRequests) {
    if (result.leaveRequests.length === 0) return `No leave requests found.\n\nQuery: "${query}"`;
    const lines = result.leaveRequests.map(
      (l) => `• ${l.employee} — ${l.leaveType} (${l.from} to ${l.to}) [${l.status}]${l.dayCount ? ` ${l.dayCount} days` : ""}${l.reason ? ` — ${l.reason}` : ""}`,
    );
    return `Zoho People — Leave Requests (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
  }

  if (result.type === "attendance" && result.attendanceRecords) {
    if (result.attendanceRecords.length === 0) return `No attendance records found.\n\nQuery: "${query}"`;
    const lines = result.attendanceRecords.map(
      (a) => `• ${a.employee} — ${a.date}: In ${a.checkIn || "N/A"}, Out ${a.checkOut || "N/A"} (${a.totalHours || "N/A"} hrs) [${a.status || "N/A"}]`,
    );
    return `Zoho People — Attendance (${result.total} records):\n${lines.join("\n")}\n\nQuery: "${query}"`;
  }

  if ((result.type === "employees" || result.type === "employee_detail") && result.employees) {
    if (result.employees.length === 0) return `No employees found matching your query.\n\nQuery: "${query}"`;
    const lines = result.employees.map((e) => {
      let line = `• ${e.name}`;
      if (e.designation) line += ` — ${e.designation}`;
      if (e.department) line += `, ${e.department}`;
      if (e.email) line += ` (${e.email})`;
      if (e.phone) line += ` | ${e.phone}`;
      if (e.location) line += ` | ${e.location}`;
      if (e.reportingTo) line += ` | Reports to: ${e.reportingTo}`;
      if (e.dateOfJoining) line += ` | Joined: ${e.dateOfJoining}`;
      line += ` [${e.status}]`;
      return line;
    });
    const label = result.type === "employee_detail" ? "Employee Search Results" : "Employees";
    return `Zoho People — ${label} (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
  }

  return `No Zoho People data found.\n\nQuery: "${query}"`;
}
