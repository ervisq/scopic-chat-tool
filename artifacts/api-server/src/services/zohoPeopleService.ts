import axios from "axios";
import { getZohoAccessToken } from "./zohoTokenManager";

export interface ZohoEmployee {
  id: string;
  employeeId: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  personalEmail: string;
  department: string;
  designation: string;
  status: string;
  dateOfJoining: string;
  reportingTo: string;
  location: string;
  phone: string;
  mobile: string;
  extension: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  bloodGroup: string;
  nationality: string;
  address: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  employmentType: string;
  experience: string;
  aboutMe: string;
  role: string;
  photoUrl: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  tags: string;
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

export type PeopleResultType =
  | "employees"
  | "employee_detail"
  | "birthdays"
  | "leave"
  | "leave_today"
  | "attendance"
  | "departments"
  | "timesheets"
  | "anniversaries"
  | "new_joiners";

export interface ZohoPeopleResult {
  type: PeopleResultType;
  employees?: ZohoEmployee[];
  leaveRequests?: ZohoLeaveRequest[];
  attendanceRecords?: ZohoAttendanceRecord[];
  departments?: ZohoDepartment[];
  timeLogs?: ZohoTimeLog[];
  total: number;
  totalFetched?: number;
  source: "live" | "error";
  contextLabel?: string;
}

const PEOPLE_BASE = "https://people.zoho.com";
const DEFAULT_LIMIT = 200;

function s(rec: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    if (rec[k]) return rec[k];
  }
  return "";
}

function mapEmployee(rec: Record<string, string>): ZohoEmployee {
  return {
    id: s(rec, "Empleado_ID", "EmployeeID", "recordid", "Zoho_ID"),
    employeeId: s(rec, "EmployeeID", "Empleado_ID", "Employee_ID"),
    firstName: s(rec, "FirstName", "First_Name"),
    lastName: s(rec, "LastName", "Last_Name"),
    name: `${s(rec, "FirstName", "First_Name")} ${s(rec, "LastName", "Last_Name")}`.trim() || s(rec, "Employee_Name", "EmployeeName"),
    email: s(rec, "EmailID", "Work_Email", "Email", "Official_Mail"),
    personalEmail: s(rec, "Personal_EmailID", "Personal_Email", "OtherEmail"),
    department: s(rec, "Department"),
    designation: s(rec, "Designation", "Title", "Job_Title"),
    status: s(rec, "Employeestatus", "Employee_Status") || "Active",
    dateOfJoining: s(rec, "Dateofjoining", "Date_of_joining", "Joining_Date"),
    reportingTo: s(rec, "Reporting_To", "ReportingTo", "Manager"),
    location: s(rec, "Location", "Work_location", "Office_Location", "Branch"),
    phone: s(rec, "Work_phone", "WorkPhone", "Phone"),
    mobile: s(rec, "Mobile", "Mobile_Phone", "Cell_Phone"),
    extension: s(rec, "Extension", "Ext"),
    dateOfBirth: s(rec, "Date_of_birth", "DateofBirth", "Birthday", "DOB"),
    gender: s(rec, "Gender"),
    maritalStatus: s(rec, "Marital_status", "MaritalStatus", "Marital_Status"),
    bloodGroup: s(rec, "Blood_group", "BloodGroup", "Blood_Group"),
    nationality: s(rec, "Nationality", "Citizenship"),
    address: s(rec, "Present_Address", "Address", "Street_Address", "Current_Address"),
    city: s(rec, "City", "Present_City"),
    state: s(rec, "State", "Present_State"),
    country: s(rec, "Country", "Present_Country"),
    zipCode: s(rec, "Zip", "ZipCode", "Zip_Code", "Postal_Code"),
    employmentType: s(rec, "Employment_Type", "EmploymentType", "Job_Type"),
    experience: s(rec, "Experience", "Total_Experience", "Years_of_Experience"),
    aboutMe: s(rec, "AboutMe", "About_Me", "Bio", "Description"),
    role: s(rec, "Role", "Zoho_Role", "UserRole"),
    photoUrl: s(rec, "Photo", "PhotoUrl", "photo", "Image_URL"),
    emergencyContactName: s(rec, "Emergency_Contact_Name", "EmergencyContact"),
    emergencyContactPhone: s(rec, "Emergency_Contact_Phone", "EmergencyPhone"),
    emergencyContactRelation: s(rec, "Emergency_Contact_Relation", "Relationship"),
    tags: s(rec, "Tags", "Tag"),
  };
}

function parseRecords(data: unknown): Record<string, string>[] {
  const results: Record<string, string>[] = [];

  if (Array.isArray(data)) {
    for (const row of data) {
      const firstVal = Object.values(row)[0];
      if (Array.isArray(firstVal)) {
        results.push((firstVal[0] || {}) as Record<string, string>);
      } else if (typeof firstVal === "object" && firstVal) {
        results.push(firstVal as Record<string, string>);
      } else {
        results.push(row as Record<string, string>);
      }
    }
    return results;
  }

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (obj.response && typeof obj.response === "object") {
      const resp = obj.response as Record<string, unknown>;
      if (resp.result) {
        console.log("[ZohoPeople:parse] result type:", typeof resp.result, "isArray:", Array.isArray(resp.result));
        if (!Array.isArray(resp.result) && typeof resp.result === "object") {
          console.log("[ZohoPeople:parse] result keys:", Object.keys(resp.result as object).slice(0, 10).join(", "));
          const firstKey = Object.keys(resp.result as object)[0];
          const firstVal = (resp.result as Record<string, unknown>)[firstKey];
          console.log("[ZohoPeople:parse] firstKey:", firstKey, "firstVal type:", typeof firstVal, "isArray:", Array.isArray(firstVal));
          if (Array.isArray(firstVal) && firstVal[0]) {
            console.log("[ZohoPeople:parse] firstVal[0] keys:", Object.keys(firstVal[0] as object).slice(0, 10).join(", "));
          } else if (typeof firstVal === "object" && firstVal) {
            console.log("[ZohoPeople:parse] firstVal keys:", Object.keys(firstVal as object).slice(0, 10).join(", "));
          }
        }

        const resultArr = Array.isArray(resp.result) ? resp.result : [resp.result];
        for (const item of resultArr) {
          if (typeof item !== "object" || !item) continue;
          for (const val of Object.values(item)) {
            if (Array.isArray(val)) {
              results.push((val[0] || {}) as Record<string, string>);
            } else if (typeof val === "object" && val) {
              results.push(val as Record<string, string>);
            }
          }
        }
        console.log("[ZohoPeople:parse] total records parsed:", results.length);
        return results;
      }
    }
  }

  return results;
}

async function fetchEmployees(accessToken: string): Promise<ZohoEmployee[]> {
  const allEmployees: ZohoEmployee[] = [];
  let sIndex = 1;
  const batchSize = 200;

  while (true) {
    let data: unknown;
    try {
      const response = await axios.get(`${PEOPLE_BASE}/people/api/forms/employee/getRecords`, {
        params: { sIndex, limit: batchSize },
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      });
      data = response.data;
      if (sIndex === 1) {
        console.log("[ZohoPeople] FULL RAW RESPONSE:", JSON.stringify(data).slice(0, 2000));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[ZohoPeople] API request failed:", msg);
      if (allEmployees.length > 0) break;
      throw new Error(`Failed to fetch employees: ${msg}`);
    }

    if (data && typeof data === "object" && !Array.isArray(data)) {
      const obj = data as Record<string, unknown>;
      const resp = obj.response as Record<string, unknown> | undefined;
      if (resp?.errors) {
        const errObj = resp.errors as Record<string, unknown>;
        if (allEmployees.length > 0) break;
        throw new Error(String(errObj.message || errObj.code || "Failed to fetch employees"));
      }
    }

    const records = parseRecords(data);

    if (records.length === 0) {
      if (allEmployees.length > 0) break;
      console.log("[ZohoPeople] No records returned. Raw:", JSON.stringify(data).slice(0, 500));
      break;
    }

    if (sIndex === 1) {
      console.log("[ZohoPeople] First batch: got", records.length, "records. Fields:", Object.keys(records[0]).slice(0, 15).join(", "));
    }

    for (const rec of records) {
      allEmployees.push(mapEmployee(rec));
    }

    if (records.length < batchSize) break;
    sIndex += batchSize;
    if (sIndex > 2000) break;
  }

  console.log("[ZohoPeople] Total employees fetched:", allEmployees.length);
  if (allEmployees.length > 0) {
    const sample = allEmployees[0];
    console.log("[ZohoPeople] Sample:", JSON.stringify({ name: sample.name, email: sample.email, dept: sample.department }));
  }

  if (allEmployees.length <= 1) {
    console.log("[ZohoPeople] Only", allEmployees.length, "record via getRecords. Trying alternate approach...");
    const altEmployees = await fetchEmployeesAlternate(accessToken);
    if (altEmployees.length > allEmployees.length) {
      console.log("[ZohoPeople] Alternate approach returned", altEmployees.length, "employees!");
      return altEmployees;
    }
    console.log("[ZohoPeople] Alternate also returned", altEmployees.length, "— may be a role restriction.");
  }

  return allEmployees;
}

function getLimitedAccessWarning(total: number): string {
  if (total <= 1) {
    return "\n\n⚠️ Note: Only your own employee record is visible. To see all employees' data, the Zoho connection must be made with an Admin or HR Manager account in Zoho People. Please ask your Zoho admin to connect, or ask them to upgrade your Zoho People role to include 'View' permissions for all employee records.";
  }
  return "";
}

async function searchEmployeeViaApi(accessToken: string, searchTerm: string): Promise<ZohoEmployee[]> {
  const results: ZohoEmployee[] = [];
  const nameSearch = searchTerm.trim();

  const searchColumns = ["EMPLOYEEMAILALIAS", "EMPLOYEEID"];
  for (const col of searchColumns) {
    try {
      const resp = await axios.get(`${PEOPLE_BASE}/people/api/forms/employee/getRecords`, {
        params: {
          searchColumn: col,
          searchValue: nameSearch,
          sIndex: 1,
          limit: 50,
        },
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      });

      const recs = parseRecords(resp.data);
      if (recs.length > 0) {
        console.log("[ZohoPeople] search via", col, "found", recs.length, "matches");
        for (const rec of recs) results.push(mapEmployee(rec));
        return results;
      }
    } catch (err) {
      console.log("[ZohoPeople] search via", col, "failed:", (err as Error).message);
    }
  }

  return results;
}

async function fetchEmployeesAlternate(accessToken: string): Promise<ZohoEmployee[]> {
  const allEmployees: ZohoEmployee[] = [];
  const seenIds = new Set<string>();

  const endpoints = [
    { url: `${PEOPLE_BASE}/people/api/forms/P_Employee/getRecords`, label: "P_Employee" },
    { url: `${PEOPLE_BASE}/people/api/department/getDepartment`, label: "departments" },
  ];

  for (const ep of endpoints) {
    try {
      const response = await axios.get(ep.url, {
        params: { sIndex: 1, limit: 200 },
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      });
      console.log(`[ZohoPeople] Alt endpoint '${ep.label}' response:`, JSON.stringify(response.data).slice(0, 500));
    } catch (err) {
      console.log(`[ZohoPeople] Alt endpoint '${ep.label}' failed:`, (err as Error).message);
    }
  }

  const searchFields = ["Department", "Reporting_To", "Work_location", "Division"];
  for (const field of searchFields) {
    try {
      const response = await axios.get(`${PEOPLE_BASE}/people/api/forms/employee/getRecords`, {
        params: { searchColumn: field, searchValue: "*", sIndex: 1, limit: 200 },
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      });
      const recs = parseRecords(response.data);
      if (recs.length > 0) {
        console.log(`[ZohoPeople] Search by ${field}=* got ${recs.length} records`);
        for (const rec of recs) {
          const emp = mapEmployee(rec);
          const id = emp.email || emp.name;
          if (!seenIds.has(id)) {
            seenIds.add(id);
            allEmployees.push(emp);
          }
        }
      }
    } catch (err) {
      console.log(`[ZohoPeople] Search by ${field}=* failed:`, (err as Error).message);
    }
  }

  try {
    const bulkUrl = `${PEOPLE_BASE}/people/api/forms/employee/records`;
    const response = await axios.get(bulkUrl, {
      params: { sIndex: 1, limit: 200 },
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });
    console.log("[ZohoPeople] Bulk /records response:", JSON.stringify(response.data).slice(0, 500));
    const recs = parseRecords(response.data);
    if (recs.length > 0) {
      for (const rec of recs) {
        const emp = mapEmployee(rec);
        const id = emp.email || emp.name;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          allEmployees.push(emp);
        }
      }
    }
  } catch (err) {
    console.log("[ZohoPeople] Bulk /records failed:", (err as Error).message);
  }

  try {
    const viewUrl = `${PEOPLE_BASE}/people/api/forms/employee/getDataByView`;
    const response = await axios.get(viewUrl, {
      params: { viewId: "All_Employees", sIndex: 1, limit: 200 },
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });
    console.log("[ZohoPeople] getDataByView response:", JSON.stringify(response.data).slice(0, 500));
    const recs = parseRecords(response.data);
    if (recs.length > 0) {
      for (const rec of recs) {
        const emp = mapEmployee(rec);
        const id = emp.email || emp.name;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          allEmployees.push(emp);
        }
      }
    }
  } catch (err) {
    console.log("[ZohoPeople] getDataByView failed:", (err as Error).message);
  }

  console.log("[ZohoPeople] Alternate total employees found:", allEmployees.length);
  return allEmployees;
}

async function searchEmployee(accessToken: string, searchTerm: string): Promise<ZohoEmployee[]> {
  const apiResults = await searchEmployeeViaApi(accessToken, searchTerm);
  if (apiResults.length > 0) return apiResults;

  const allEmployees = await fetchEmployees(accessToken);
  const lower = searchTerm.toLowerCase();
  const filtered = allEmployees.filter(
    (e) =>
      e.name.toLowerCase().includes(lower) ||
      e.email.toLowerCase().includes(lower) ||
      e.department.toLowerCase().includes(lower) ||
      e.designation.toLowerCase().includes(lower) ||
      e.employeeId.toLowerCase().includes(lower) ||
      e.location.toLowerCase().includes(lower),
  );

  if (filtered.length === 0 && allEmployees.length <= 1) {
    return allEmployees;
  }

  return filtered;
}

function parseZohoDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  let d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;

  const ddMmYyyy = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (ddMmYyyy) {
    d = new Date(parseInt(ddMmYyyy[3]), parseInt(ddMmYyyy[2]) - 1, parseInt(ddMmYyyy[1]));
    if (!isNaN(d.getTime())) return d;
    d = new Date(parseInt(ddMmYyyy[3]), parseInt(ddMmYyyy[1]) - 1, parseInt(ddMmYyyy[2]));
    if (!isNaN(d.getTime())) return d;
  }

  const namedMonth = dateStr.match(/(\d{1,2})[-\s](\w{3,})[-\s](\d{4})/);
  if (namedMonth) {
    d = new Date(`${namedMonth[2]} ${namedMonth[1]}, ${namedMonth[3]}`);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

function filterBirthdays(employees: ZohoEmployee[], period: "today" | "this_week" | "this_month"): ZohoEmployee[] {
  const today = new Date();
  const todayMonth = today.getMonth();
  const todayDate = today.getDate();

  return employees.filter((e) => {
    if (!e.dateOfBirth) return false;
    const dob = parseZohoDate(e.dateOfBirth);
    if (!dob) return false;

    const dobMonth = dob.getMonth();
    const dobDate = dob.getDate();

    if (period === "today") {
      return dobMonth === todayMonth && dobDate === todayDate;
    }

    if (period === "this_week") {
      const startOfWeek = new Date(today);
      const dayOfWeek = today.getDay();
      startOfWeek.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      for (let d = new Date(startOfWeek); d <= endOfWeek; d.setDate(d.getDate() + 1)) {
        if (d.getMonth() === dobMonth && d.getDate() === dobDate) return true;
      }
      return false;
    }

    if (period === "this_month") {
      return dobMonth === todayMonth;
    }

    return false;
  });
}

function filterAnniversaries(employees: ZohoEmployee[], period: "today" | "this_week" | "this_month"): ZohoEmployee[] {
  const today = new Date();
  const todayMonth = today.getMonth();
  const todayDate = today.getDate();

  return employees.filter((e) => {
    if (!e.dateOfJoining) return false;
    const joinDate = parseZohoDate(e.dateOfJoining);
    if (!joinDate) return false;
    if (joinDate.getFullYear() === today.getFullYear()) return false;

    const joinMonth = joinDate.getMonth();
    const joinDay = joinDate.getDate();

    if (period === "today") {
      return joinMonth === todayMonth && joinDay === todayDate;
    }

    if (period === "this_week") {
      const startOfWeek = new Date(today);
      const dayOfWeek = today.getDay();
      startOfWeek.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      for (let d = new Date(startOfWeek); d <= endOfWeek; d.setDate(d.getDate() + 1)) {
        if (d.getMonth() === joinMonth && d.getDate() === joinDay) return true;
      }
      return false;
    }

    if (period === "this_month") {
      return joinMonth === todayMonth;
    }

    return false;
  });
}

function filterNewJoiners(employees: ZohoEmployee[], period: "this_week" | "this_month" | "last_month" | "this_year"): ZohoEmployee[] {
  const today = new Date();

  return employees.filter((e) => {
    if (!e.dateOfJoining) return false;
    const joinDate = parseZohoDate(e.dateOfJoining);
    if (!joinDate) return false;

    if (period === "this_week") {
      const startOfWeek = new Date(today);
      const dayOfWeek = today.getDay();
      startOfWeek.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      return joinDate >= startOfWeek && joinDate <= today;
    }

    if (period === "this_month") {
      return joinDate.getMonth() === today.getMonth() && joinDate.getFullYear() === today.getFullYear();
    }

    if (period === "last_month") {
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      return joinDate >= lastMonth && joinDate <= lastMonthEnd;
    }

    if (period === "this_year") {
      return joinDate.getFullYear() === today.getFullYear();
    }

    return false;
  });
}

function filterTodayLeave(leaveRequests: ZohoLeaveRequest[]): ZohoLeaveRequest[] {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const approvedStatuses = ["approved", "taken"];

  return leaveRequests.filter((l) => {
    if (!approvedStatuses.includes(l.status.toLowerCase())) return false;
    const from = new Date(l.from);
    const to = new Date(l.to);
    const todayDate = new Date(todayStr);
    return !isNaN(from.getTime()) && !isNaN(to.getTime()) && todayDate >= from && todayDate <= to;
  });
}

async function fetchLeaveRequests(accessToken: string): Promise<ZohoLeaveRequest[]> {
  const allLeave: ZohoLeaveRequest[] = [];
  let sIndex = 1;
  const batchSize = 200;

  while (true) {
    const response = await axios.get(`${PEOPLE_BASE}/people/api/forms/leave/getRecords`, {
      params: { sIndex, limit: batchSize },
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });

    const data = response.data;
    if (!data || data.response?.errors) {
      if (allLeave.length > 0) break;
      throw new Error(data.response?.errors?.message || "Failed to fetch leave requests");
    }

    const records = Array.isArray(data) ? data : [];
    if (records.length === 0) break;

    for (const row of records) {
      const rec = (Object.values(row)[0]?.[0] || {}) as Record<string, string>;
      allLeave.push({
        id: s(rec, "Leavetype_ID", "recordid"),
        employee: s(rec, "Employee_Name", "EmployeeName", "Employee"),
        leaveType: s(rec, "Leavetype", "LeaveType", "Leave_Type"),
        from: s(rec, "From", "Start_Date"),
        to: s(rec, "To", "End_Date"),
        status: s(rec, "ApprovalStatus", "Approval_Status") || "Pending",
        dayCount: s(rec, "Daystaken", "Days", "Day_Count"),
        reason: s(rec, "Reason", "Description"),
      });
    }

    if (records.length < batchSize) break;
    sIndex += batchSize;
    if (sIndex > 2000) break;
  }

  return allLeave;
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

  if (lower.includes("yesterday")) {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const d = yesterday.toISOString().split("T")[0];
    return { start: d, end: d };
  }

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
    lastFriday.setDate(lastMonday.getDate() + 6);
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
    /(?:find|search|look up|lookup|info (?:about|on|for)|details (?:of|for|about)|who is|tell me about|about|profile (?:of|for))\s+(.+)/i,
    /(?:employee|person|staff|member|colleague)\s+(?:named?|called?)\s+(.+)/i,
    /(?:contact|phone|email|number|address)\s+(?:of|for)\s+(.+)/i,
    /(?:what is|what's|get)\s+(.+?)(?:'s)?\s+(?:email|phone|number|address|department|birthday|role|designation|manager)/i,
    /(.+?)(?:'s)\s+(?:email|phone|number|address|department|birthday|info|details|profile|role|designation|manager)/i,
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match) {
      let term = match[1].trim().replace(/[?.,!]$/g, "");
      term = term.replace(/^(the|a|an|employee|person|staff)\s+/i, "");
      if (term.length > 1) return term;
    }
  }
  return null;
}

function detectPeriod(query: string, defaultPeriod: string): string {
  const lower = query.toLowerCase();
  if (lower.includes("last month")) return "last_month";
  if (lower.includes("last week")) return "last_week";
  if (lower.includes("this week")) return "this_week";
  if (lower.includes("this month")) return "this_month";
  if (lower.includes("this year") || lower.includes("year")) return "this_year";
  if (lower.includes("week")) return "this_week";
  if (lower.includes("month")) return "this_month";
  return defaultPeriod;
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

  if (lower.includes("birthday") || lower.includes("born today") || lower.includes("bday")) {
    const employees = await fetchEmployees(accessToken);
    const period = detectPeriod(query, "today") as "today" | "this_week" | "this_month";
    const matches = filterBirthdays(employees, period);
    const label = period === "today" ? "Today's Birthdays" : period === "this_week" ? "Birthdays This Week" : "Birthdays This Month";
    return { type: "birthdays", employees: matches, total: matches.length, source: "live", contextLabel: label };
  }

  if (lower.includes("anniversary") || lower.includes("work anniversary") || lower.includes("years of service")) {
    const employees = await fetchEmployees(accessToken);
    const period = detectPeriod(query, "today") as "today" | "this_week" | "this_month";
    const matches = filterAnniversaries(employees, period);
    const label = period === "today" ? "Today's Work Anniversaries" : period === "this_week" ? "Work Anniversaries This Week" : "Work Anniversaries This Month";
    return { type: "anniversaries", employees: matches, total: matches.length, source: "live", contextLabel: label };
  }

  if (lower.includes("new join") || lower.includes("newly joined") || lower.includes("new hire") || lower.includes("new employee") || lower.includes("recent join") || lower.includes("onboard")) {
    const employees = await fetchEmployees(accessToken);
    const period = detectPeriod(query, "this_month") as "this_week" | "this_month" | "last_month" | "this_year";
    const matches = filterNewJoiners(employees, period);
    const label = period === "this_week" ? "New Joiners This Week" : period === "this_month" ? "New Joiners This Month" : period === "last_month" ? "New Joiners Last Month" : "New Joiners This Year";
    return { type: "new_joiners", employees: matches, total: matches.length, source: "live", contextLabel: label };
  }

  if (
    (lower.includes("who") && (lower.includes("off") || lower.includes("leave") || lower.includes("absent") || lower.includes("away") || lower.includes("holiday") || lower.includes("vacation"))) ||
    lower.includes("off today") ||
    lower.includes("on leave today") ||
    lower.includes("out today") ||
    lower.includes("absent today") ||
    lower.includes("on holiday") ||
    lower.includes("on vacation")
  ) {
    const leaveRequests = await fetchLeaveRequests(accessToken);
    const todayLeave = filterTodayLeave(leaveRequests);
    return { type: "leave_today", leaveRequests: todayLeave, total: todayLeave.length, source: "live", contextLabel: "Who's Off Today" };
  }

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

  if (lower.includes("leave") || lower.includes("time off") || lower.includes("pto") || lower.includes("absence") || lower.includes("sick day")) {
    const leaveRequests = await fetchLeaveRequests(accessToken);
    return { type: "leave", leaveRequests, total: leaveRequests.length, source: "live" };
  }

  if (lower.includes("attendance") || lower.includes("check-in") || lower.includes("checkin") || lower.includes("check in") || lower.includes("punch") || lower.includes("clock in") || lower.includes("clock out") || lower.includes("present today") || lower.includes("who came") || lower.includes("who is in")) {
    const dateRange = parseDateRange(query);
    const attendanceRecords = await fetchAttendance(accessToken, dateRange);
    return { type: "attendance", attendanceRecords, total: attendanceRecords.length, source: "live" };
  }

  if (lower.includes("my profile") || lower.includes("my info") || lower.includes("my details") || lower.includes("my data") || lower.includes("my personal") || lower.includes("my record") || lower.includes("my employee")) {
    const employees = await fetchEmployees(accessToken);
    return { type: "employees", employees, total: employees.length, source: "live", contextLabel: "Employee Directory — user is looking for their own profile" };
  }

  if (lower.includes("headcount") || lower.includes("how many employee") || lower.includes("total employee") || lower.includes("employee count") || lower.includes("team size") || lower.includes("staff count")) {
    const employees = await fetchEmployees(accessToken);
    const active = employees.filter((e) => e.status.toLowerCase() === "active");
    return { type: "employees", employees: active, total: active.length, source: "live", contextLabel: `Active Headcount: ${active.length}` };
  }

  if (lower.includes("manager") || lower.includes("report to") || lower.includes("reporting to") || lower.includes("supervisor") || lower.includes("direct report")) {
    const employees = await fetchEmployees(accessToken);
    return { type: "employees", employees, total: employees.length, source: "live", contextLabel: "Organization Hierarchy" };
  }

  const searchTerm = extractSearchTerm(query);
  if (searchTerm) {
    const employees = await searchEmployee(accessToken, searchTerm);
    const allCount = employees.length;
    return { type: "employee_detail", employees, total: employees.length, totalFetched: allCount, source: "live" };
  }

  const employees = await fetchEmployees(accessToken);
  return { type: "employees", employees, total: employees.length, totalFetched: employees.length, source: "live" };
}

export function formatPeopleResult(result: ZohoPeopleResult, query: string): string {
  const q = `\n\nQuery: "${query}"`;
  const label = result.contextLabel || "";

  if (result.type === "birthdays" && result.employees) {
    if (result.employees.length === 0) return `No birthdays found for the requested period.${q}`;
    const lines = result.employees.map((e) => {
      const dob = e.dateOfBirth ? new Date(e.dateOfBirth) : null;
      const age = dob ? new Date().getFullYear() - dob.getFullYear() : null;
      return `• ${e.name} — ${e.designation || "N/A"}, ${e.department || "N/A"} | DOB: ${e.dateOfBirth}${age ? ` (turning ${age})` : ""} | ${e.email}`;
    });
    return `Zoho People — ${label} (${result.total} found):\n${lines.join("\n")}${q}`;
  }

  if (result.type === "anniversaries" && result.employees) {
    if (result.employees.length === 0) return `No work anniversaries found for the requested period.${q}`;
    const lines = result.employees.map((e) => {
      const joinDate = e.dateOfJoining ? new Date(e.dateOfJoining) : null;
      const years = joinDate ? new Date().getFullYear() - joinDate.getFullYear() : null;
      return `• ${e.name} — ${e.designation || "N/A"}, ${e.department || "N/A"} | Joined: ${e.dateOfJoining}${years ? ` (${years} years)` : ""} | ${e.email}`;
    });
    return `Zoho People — ${label} (${result.total} found):\n${lines.join("\n")}${q}`;
  }

  if (result.type === "new_joiners" && result.employees) {
    if (result.employees.length === 0) return `No new joiners found for the requested period.${q}`;
    const lines = result.employees.map((e) =>
      `• ${e.name} — ${e.designation || "N/A"}, ${e.department || "N/A"} | Joined: ${e.dateOfJoining} | ${e.email}`,
    );
    return `Zoho People — ${label} (${result.total} found):\n${lines.join("\n")}${q}`;
  }

  if (result.type === "leave_today" && result.leaveRequests) {
    if (result.leaveRequests.length === 0) return `Nobody is on leave today! Everyone is in.${q}`;
    const lines = result.leaveRequests.map(
      (l) => `• ${l.employee} — ${l.leaveType} (${l.from} to ${l.to}) [${l.status}]${l.reason ? ` — ${l.reason}` : ""}`,
    );
    return `Zoho People — Who's Off Today (${result.total} people):\n${lines.join("\n")}${q}`;
  }

  if (result.type === "departments" && result.departments) {
    if (result.departments.length === 0) return `No departments found.${q}`;
    const lines = result.departments.map(
      (d) => `• ${d.name}${d.parentDepartment ? ` (under ${d.parentDepartment})` : ""}`,
    );
    return `Zoho People — Departments (${result.total} found):\n${lines.join("\n")}${q}`;
  }

  if (result.type === "timesheets" && result.timeLogs) {
    if (result.timeLogs.length === 0) return `No timesheet entries found.${q}`;
    const lines = result.timeLogs.map(
      (t) => `• ${t.employee} — ${t.project || "No project"}: ${t.taskName || "General"} (${t.hours} hrs on ${t.date})${t.description ? ` — ${t.description}` : ""}`,
    );
    return `Zoho People — Timesheets (${result.total} entries):\n${lines.join("\n")}${q}`;
  }

  if (result.type === "leave" && result.leaveRequests) {
    if (result.leaveRequests.length === 0) return `No leave requests found.${q}`;
    const lines = result.leaveRequests.map(
      (l) => `• ${l.employee} — ${l.leaveType} (${l.from} to ${l.to}) [${l.status}]${l.dayCount ? ` ${l.dayCount} days` : ""}${l.reason ? ` — ${l.reason}` : ""}`,
    );
    return `Zoho People — Leave Requests (${result.total} found):\n${lines.join("\n")}${q}`;
  }

  if (result.type === "attendance" && result.attendanceRecords) {
    if (result.attendanceRecords.length === 0) return `No attendance records found.${q}`;
    const lines = result.attendanceRecords.map(
      (a) => `• ${a.employee} — ${a.date}: In ${a.checkIn || "N/A"}, Out ${a.checkOut || "N/A"} (${a.totalHours || "N/A"} hrs) [${a.status || "N/A"}]`,
    );
    return `Zoho People — Attendance (${result.total} records):\n${lines.join("\n")}${q}`;
  }

  if ((result.type === "employees" || result.type === "employee_detail") && result.employees) {
    const fetchedCount = result.totalFetched ?? result.total;
    if (result.employees.length === 0) return `No employees found matching your query.${getLimitedAccessWarning(fetchedCount)}${q}`;
    const isDetail = result.type === "employee_detail" || result.employees.length <= 5;
    const lines = result.employees.map((e) => {
      if (isDetail) {
        let line = `• ${e.name}`;
        if (e.employeeId) line += ` (ID: ${e.employeeId})`;
        line += "\n";
        if (e.designation) line += `  Title: ${e.designation}\n`;
        if (e.department) line += `  Department: ${e.department}\n`;
        if (e.email) line += `  Work Email: ${e.email}\n`;
        if (e.personalEmail) line += `  Personal Email: ${e.personalEmail}\n`;
        if (e.phone) line += `  Phone: ${e.phone}\n`;
        if (e.mobile) line += `  Mobile: ${e.mobile}\n`;
        if (e.location) line += `  Location: ${e.location}\n`;
        if (e.dateOfBirth) line += `  Date of Birth: ${e.dateOfBirth}\n`;
        if (e.gender) line += `  Gender: ${e.gender}\n`;
        if (e.maritalStatus) line += `  Marital Status: ${e.maritalStatus}\n`;
        if (e.nationality) line += `  Nationality: ${e.nationality}\n`;
        if (e.bloodGroup) line += `  Blood Group: ${e.bloodGroup}\n`;
        if (e.address || e.city || e.country) {
          const addr = [e.address, e.city, e.state, e.country, e.zipCode].filter(Boolean).join(", ");
          line += `  Address: ${addr}\n`;
        }
        if (e.reportingTo) line += `  Reports To: ${e.reportingTo}\n`;
        if (e.dateOfJoining) line += `  Date of Joining: ${e.dateOfJoining}\n`;
        if (e.employmentType) line += `  Employment Type: ${e.employmentType}\n`;
        if (e.experience) line += `  Experience: ${e.experience}\n`;
        if (e.role) line += `  Role: ${e.role}\n`;
        if (e.aboutMe) line += `  About: ${e.aboutMe}\n`;
        if (e.emergencyContactName) line += `  Emergency Contact: ${e.emergencyContactName} (${e.emergencyContactRelation || "N/A"}) ${e.emergencyContactPhone || ""}\n`;
        if (e.tags) line += `  Tags: ${e.tags}\n`;
        line += `  Status: ${e.status}`;
        return line;
      }
      let line = `• ${e.name}`;
      if (e.designation) line += ` — ${e.designation}`;
      if (e.department) line += `, ${e.department}`;
      if (e.email) line += ` (${e.email})`;
      if (e.phone || e.mobile) line += ` | ${e.phone || e.mobile}`;
      if (e.location) line += ` | ${e.location}`;
      if (e.reportingTo) line += ` | Reports to: ${e.reportingTo}`;
      if (e.dateOfJoining) line += ` | Joined: ${e.dateOfJoining}`;
      line += ` [${e.status}]`;
      return line;
    });
    const heading = label || (result.type === "employee_detail" ? "Employee Details" : "Employees");
    const warning = getLimitedAccessWarning(fetchedCount);
    return `Zoho People — ${heading} (${result.total} found):\n${lines.join("\n")}${warning}${q}`;
  }

  return `No Zoho People data found.${q}`;
}
