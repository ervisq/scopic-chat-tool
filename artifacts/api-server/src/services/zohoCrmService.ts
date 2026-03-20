import axios from "axios";
import { getZohoAccessToken } from "./zohoTokenManager";

export interface ZohoLead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  status: string;
  source: string;
  createdTime: string;
}

export interface ZohoContact {
  id: string;
  name: string;
  email: string;
  phone: string;
  account: string;
  title: string;
  department: string;
  mailingCity: string;
}

export interface ZohoDeal {
  id: string;
  name: string;
  stage: string;
  amount: string;
  closingDate: string;
  account: string;
  contactName: string;
  probability: string;
  type: string;
}

export interface ZohoAccount {
  id: string;
  name: string;
  industry: string;
  phone: string;
  website: string;
  annualRevenue: string;
  employees: string;
  billingCity: string;
  accountType: string;
}

export interface ZohoTask {
  id: string;
  subject: string;
  status: string;
  priority: string;
  dueDate: string;
  relatedTo: string;
  assignedTo: string;
  description: string;
}

export interface ZohoEvent {
  id: string;
  title: string;
  startDateTime: string;
  endDateTime: string;
  location: string;
  participants: string;
  description: string;
}

export interface ZohoCall {
  id: string;
  subject: string;
  callType: string;
  callDuration: string;
  callStartTime: string;
  relatedTo: string;
  contactName: string;
  callResult: string;
}

export interface ZohoProduct {
  id: string;
  name: string;
  productCode: string;
  unitPrice: string;
  category: string;
  manufacturer: string;
  isActive: boolean;
}

export interface ZohoQuote {
  id: string;
  subject: string;
  stage: string;
  grandTotal: string;
  validTill: string;
  account: string;
  contactName: string;
}

export interface ZohoInvoice {
  id: string;
  subject: string;
  status: string;
  grandTotal: string;
  dueDate: string;
  account: string;
  invoiceDate: string;
}

export interface ZohoCampaign {
  id: string;
  name: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  expectedRevenue: string;
  budgetedCost: string;
}

export interface ZohoVendor {
  id: string;
  name: string;
  email: string;
  phone: string;
  category: string;
  city: string;
  website: string;
}

export type CrmResultType = "leads" | "contacts" | "deals" | "accounts" | "tasks" | "events" | "calls" | "products" | "quotes" | "invoices" | "campaigns" | "vendors";

export interface ZohoCrmResult {
  type: CrmResultType;
  leads?: ZohoLead[];
  contacts?: ZohoContact[];
  deals?: ZohoDeal[];
  accounts?: ZohoAccount[];
  tasks?: ZohoTask[];
  events?: ZohoEvent[];
  calls?: ZohoCall[];
  products?: ZohoProduct[];
  quotes?: ZohoQuote[];
  invoices?: ZohoInvoice[];
  campaigns?: ZohoCampaign[];
  vendors?: ZohoVendor[];
  total: number;
  source: "live" | "error";
}

const CRM_BASE = "https://www.zohoapis.com";
const DEFAULT_LIMIT = 200;

async function fetchModule<T>(
  accessToken: string,
  module: string,
  mapper: (record: Record<string, unknown>) => T,
  params?: Record<string, string>,
): Promise<T[]> {
  const response = await axios.get(`${CRM_BASE}/crm/v7/${module}`, {
    params: { per_page: DEFAULT_LIMIT, ...params },
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });

  const records = response.data?.data || [];
  return records.map(mapper);
}

async function searchModule<T>(
  accessToken: string,
  module: string,
  criteria: string,
  mapper: (record: Record<string, unknown>) => T,
): Promise<T[]> {
  try {
    const response = await axios.get(`${CRM_BASE}/crm/v7/${module}/search`, {
      params: { criteria, per_page: DEFAULT_LIMIT },
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });
    const records = response.data?.data || [];
    return records.map(mapper);
  } catch {
    return [];
  }
}

function str(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "object" && val !== null && "name" in val) return String((val as Record<string, unknown>).name || "");
  return String(val);
}

function mapLead(r: Record<string, unknown>): ZohoLead {
  return {
    id: str(r.id),
    name: `${str(r.First_Name)} ${str(r.Last_Name)}`.trim() || str(r.Full_Name),
    company: str(r.Company),
    email: str(r.Email),
    phone: str(r.Phone) || str(r.Mobile),
    status: str(r.Lead_Status),
    source: str(r.Lead_Source),
    createdTime: str(r.Created_Time),
  };
}

function mapContact(r: Record<string, unknown>): ZohoContact {
  return {
    id: str(r.id),
    name: `${str(r.First_Name)} ${str(r.Last_Name)}`.trim() || str(r.Full_Name),
    email: str(r.Email),
    phone: str(r.Phone) || str(r.Mobile),
    account: str(r.Account_Name),
    title: str(r.Title),
    department: str(r.Department),
    mailingCity: str(r.Mailing_City),
  };
}

function mapDeal(r: Record<string, unknown>): ZohoDeal {
  const amount = r.Amount ? `$${Number(r.Amount).toLocaleString()}` : "N/A";
  return {
    id: str(r.id),
    name: str(r.Deal_Name),
    stage: str(r.Stage),
    amount,
    closingDate: str(r.Closing_Date),
    account: str(r.Account_Name),
    contactName: str(r.Contact_Name),
    probability: r.Probability ? `${r.Probability}%` : "",
    type: str(r.Type),
  };
}

function mapAccount(r: Record<string, unknown>): ZohoAccount {
  const revenue = r.Annual_Revenue ? `$${Number(r.Annual_Revenue).toLocaleString()}` : "";
  return {
    id: str(r.id),
    name: str(r.Account_Name),
    industry: str(r.Industry),
    phone: str(r.Phone),
    website: str(r.Website),
    annualRevenue: revenue,
    employees: str(r.Employees),
    billingCity: str(r.Billing_City),
    accountType: str(r.Account_Type),
  };
}

function mapTask(r: Record<string, unknown>): ZohoTask {
  return {
    id: str(r.id),
    subject: str(r.Subject),
    status: str(r.Status),
    priority: str(r.Priority),
    dueDate: str(r.Due_Date),
    relatedTo: str(r.What_Id) || str(r.$se_module),
    assignedTo: str(r.Owner),
    description: str(r.Description),
  };
}

function mapEvent(r: Record<string, unknown>): ZohoEvent {
  const participants = Array.isArray(r.Participants)
    ? (r.Participants as Record<string, unknown>[]).map((p) => str(p.name) || str(p.Email)).join(", ")
    : "";
  return {
    id: str(r.id),
    title: str(r.Event_Title),
    startDateTime: str(r.Start_DateTime),
    endDateTime: str(r.End_DateTime),
    location: str(r.Location),
    participants,
    description: str(r.Description),
  };
}

function mapCall(r: Record<string, unknown>): ZohoCall {
  return {
    id: str(r.id),
    subject: str(r.Subject),
    callType: str(r.Call_Type),
    callDuration: str(r.Call_Duration),
    callStartTime: str(r.Call_Start_Time),
    relatedTo: str(r.What_Id),
    contactName: str(r.Who_Id),
    callResult: str(r.Call_Result),
  };
}

function mapProduct(r: Record<string, unknown>): ZohoProduct {
  return {
    id: str(r.id),
    name: str(r.Product_Name),
    productCode: str(r.Product_Code),
    unitPrice: r.Unit_Price ? `$${Number(r.Unit_Price).toLocaleString()}` : "",
    category: str(r.Product_Category),
    manufacturer: str(r.Manufacturer),
    isActive: r.Product_Active !== false,
  };
}

function mapQuote(r: Record<string, unknown>): ZohoQuote {
  return {
    id: str(r.id),
    subject: str(r.Subject),
    stage: str(r.Quote_Stage),
    grandTotal: r.Grand_Total ? `$${Number(r.Grand_Total).toLocaleString()}` : "",
    validTill: str(r.Valid_Till),
    account: str(r.Account_Name),
    contactName: str(r.Contact_Name),
  };
}

function mapInvoice(r: Record<string, unknown>): ZohoInvoice {
  return {
    id: str(r.id),
    subject: str(r.Subject),
    status: str(r.Status),
    grandTotal: r.Grand_Total ? `$${Number(r.Grand_Total).toLocaleString()}` : "",
    dueDate: str(r.Due_Date),
    account: str(r.Account_Name),
    invoiceDate: str(r.Invoice_Date),
  };
}

function mapCampaign(r: Record<string, unknown>): ZohoCampaign {
  return {
    id: str(r.id),
    name: str(r.Campaign_Name),
    type: str(r.Type),
    status: str(r.Status),
    startDate: str(r.Start_Date),
    endDate: str(r.End_Date),
    expectedRevenue: r.Expected_Revenue ? `$${Number(r.Expected_Revenue).toLocaleString()}` : "",
    budgetedCost: r.Budgeted_Cost ? `$${Number(r.Budgeted_Cost).toLocaleString()}` : "",
  };
}

function mapVendor(r: Record<string, unknown>): ZohoVendor {
  return {
    id: str(r.id),
    name: str(r.Vendor_Name),
    email: str(r.Email),
    phone: str(r.Phone),
    category: str(r.Category),
    city: str(r.City),
    website: str(r.Website),
  };
}

function detectCrmModule(query: string): CrmResultType {
  const lower = query.toLowerCase();

  if (lower.includes("task")) return "tasks";
  if (lower.includes("event") || lower.includes("meeting") || lower.includes("calendar") || lower.includes("appointment") || lower.includes("schedule")) return "events";
  if (lower.includes("call") || lower.includes("phone log")) return "calls";
  if (lower.includes("product") || lower.includes("catalog") || lower.includes("item") || lower.includes("inventory")) return "products";
  if (lower.includes("quote") || lower.includes("quotation") || lower.includes("proposal") || lower.includes("estimate")) return "quotes";
  if (lower.includes("invoice") || lower.includes("billing") || lower.includes("payment")) return "invoices";
  if (lower.includes("campaign") || lower.includes("marketing")) return "campaigns";
  if (lower.includes("vendor") || lower.includes("supplier")) return "vendors";
  if (lower.includes("lead") || lower.includes("prospect")) return "leads";
  if (lower.includes("deal") || lower.includes("pipeline") || lower.includes("opportunity") || lower.includes("sale")) return "deals";
  if (lower.includes("account") || lower.includes("company") || lower.includes("organization") || lower.includes("client")) return "accounts";

  return "contacts";
}

export async function queryZohoCrm(
  query: string,
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  domain?: string,
): Promise<ZohoCrmResult> {
  const accessToken = await getZohoAccessToken(clientId, clientSecret, refreshToken, domain);
  const moduleType = detectCrmModule(query);

  switch (moduleType) {
    case "leads": {
      const leads = await fetchModule(accessToken, "Leads", mapLead);
      return { type: "leads", leads, total: leads.length, source: "live" };
    }
    case "deals": {
      const deals = await fetchModule(accessToken, "Deals", mapDeal);
      return { type: "deals", deals, total: deals.length, source: "live" };
    }
    case "accounts": {
      const accounts = await fetchModule(accessToken, "Accounts", mapAccount);
      return { type: "accounts", accounts, total: accounts.length, source: "live" };
    }
    case "tasks": {
      const tasks = await fetchModule(accessToken, "Tasks", mapTask);
      return { type: "tasks", tasks, total: tasks.length, source: "live" };
    }
    case "events": {
      const events = await fetchModule(accessToken, "Events", mapEvent);
      return { type: "events", events, total: events.length, source: "live" };
    }
    case "calls": {
      const calls = await fetchModule(accessToken, "Calls", mapCall);
      return { type: "calls", calls, total: calls.length, source: "live" };
    }
    case "products": {
      const products = await fetchModule(accessToken, "Products", mapProduct);
      return { type: "products", products, total: products.length, source: "live" };
    }
    case "quotes": {
      const quotes = await fetchModule(accessToken, "Quotes", mapQuote);
      return { type: "quotes", quotes, total: quotes.length, source: "live" };
    }
    case "invoices": {
      const invoices = await fetchModule(accessToken, "Invoices", mapInvoice);
      return { type: "invoices", invoices, total: invoices.length, source: "live" };
    }
    case "campaigns": {
      const campaigns = await fetchModule(accessToken, "Campaigns", mapCampaign);
      return { type: "campaigns", campaigns, total: campaigns.length, source: "live" };
    }
    case "vendors": {
      const vendors = await fetchModule(accessToken, "Vendors", mapVendor);
      return { type: "vendors", vendors, total: vendors.length, source: "live" };
    }
    default: {
      const contacts = await fetchModule(accessToken, "Contacts", mapContact);
      return { type: "contacts", contacts, total: contacts.length, source: "live" };
    }
  }
}

export function formatCrmResult(result: ZohoCrmResult, query: string): string {
  const q = `\n\nQuery: "${query}"`;

  if (result.type === "leads" && result.leads) {
    if (result.leads.length === 0) return `No leads found.${q}`;
    const lines = result.leads.map(
      (l) => `• ${l.name} — ${l.company} (${l.email}${l.phone ? ` | ${l.phone}` : ""}) [${l.status}] Source: ${l.source}`,
    );
    return `Zoho CRM — Leads (${result.total} found):\n${lines.join("\n")}${q}`;
  }

  if (result.type === "deals" && result.deals) {
    if (result.deals.length === 0) return `No deals found.${q}`;
    const lines = result.deals.map(
      (d) => `• ${d.name} — ${d.stage} (${d.amount}) Close: ${d.closingDate} [${d.account}]${d.probability ? ` ${d.probability} prob` : ""}${d.contactName ? ` Contact: ${d.contactName}` : ""}`,
    );
    return `Zoho CRM — Deals (${result.total} found):\n${lines.join("\n")}${q}`;
  }

  if (result.type === "accounts" && result.accounts) {
    if (result.accounts.length === 0) return `No accounts found.${q}`;
    const lines = result.accounts.map(
      (a) => `• ${a.name} — ${a.industry || "N/A"} (${a.phone || "N/A"}) ${a.website || ""}${a.annualRevenue ? ` Revenue: ${a.annualRevenue}` : ""}${a.employees ? ` | ${a.employees} employees` : ""}${a.billingCity ? ` | ${a.billingCity}` : ""} [${a.accountType || "N/A"}]`,
    );
    return `Zoho CRM — Accounts (${result.total} found):\n${lines.join("\n")}${q}`;
  }

  if (result.type === "tasks" && result.tasks) {
    if (result.tasks.length === 0) return `No tasks found.${q}`;
    const lines = result.tasks.map(
      (t) => `• ${t.subject} — [${t.status}] Priority: ${t.priority || "Normal"} Due: ${t.dueDate || "N/A"}${t.assignedTo ? ` | Assigned: ${t.assignedTo}` : ""}`,
    );
    return `Zoho CRM — Tasks (${result.total} found):\n${lines.join("\n")}${q}`;
  }

  if (result.type === "events" && result.events) {
    if (result.events.length === 0) return `No events found.${q}`;
    const lines = result.events.map(
      (e) => `• ${e.title} — ${e.startDateTime} to ${e.endDateTime}${e.location ? ` @ ${e.location}` : ""}${e.participants ? ` | With: ${e.participants}` : ""}`,
    );
    return `Zoho CRM — Events/Meetings (${result.total} found):\n${lines.join("\n")}${q}`;
  }

  if (result.type === "calls" && result.calls) {
    if (result.calls.length === 0) return `No calls found.${q}`;
    const lines = result.calls.map(
      (c) => `• ${c.subject} — ${c.callType} (${c.callDuration || "N/A"}) ${c.callStartTime || ""}${c.contactName ? ` | ${c.contactName}` : ""} [${c.callResult || "N/A"}]`,
    );
    return `Zoho CRM — Calls (${result.total} found):\n${lines.join("\n")}${q}`;
  }

  if (result.type === "products" && result.products) {
    if (result.products.length === 0) return `No products found.${q}`;
    const lines = result.products.map(
      (p) => `• ${p.name}${p.productCode ? ` (${p.productCode})` : ""} — ${p.unitPrice || "N/A"}${p.category ? ` | ${p.category}` : ""}${p.manufacturer ? ` | ${p.manufacturer}` : ""} [${p.isActive ? "Active" : "Inactive"}]`,
    );
    return `Zoho CRM — Products (${result.total} found):\n${lines.join("\n")}${q}`;
  }

  if (result.type === "quotes" && result.quotes) {
    if (result.quotes.length === 0) return `No quotes found.${q}`;
    const lines = result.quotes.map(
      (q2) => `• ${q2.subject} — ${q2.stage || "N/A"} (${q2.grandTotal || "N/A"}) Valid till: ${q2.validTill || "N/A"} [${q2.account || "N/A"}]`,
    );
    return `Zoho CRM — Quotes (${result.total} found):\n${lines.join("\n")}${q}`;
  }

  if (result.type === "invoices" && result.invoices) {
    if (result.invoices.length === 0) return `No invoices found.${q}`;
    const lines = result.invoices.map(
      (inv) => `• ${inv.subject} — ${inv.grandTotal || "N/A"} [${inv.status}] Due: ${inv.dueDate || "N/A"} | Issued: ${inv.invoiceDate || "N/A"} [${inv.account || "N/A"}]`,
    );
    return `Zoho CRM — Invoices (${result.total} found):\n${lines.join("\n")}${q}`;
  }

  if (result.type === "campaigns" && result.campaigns) {
    if (result.campaigns.length === 0) return `No campaigns found.${q}`;
    const lines = result.campaigns.map(
      (c) => `• ${c.name} — ${c.type || "N/A"} [${c.status}] ${c.startDate || ""} to ${c.endDate || ""}${c.expectedRevenue ? ` | Expected: ${c.expectedRevenue}` : ""}${c.budgetedCost ? ` | Budget: ${c.budgetedCost}` : ""}`,
    );
    return `Zoho CRM — Campaigns (${result.total} found):\n${lines.join("\n")}${q}`;
  }

  if (result.type === "vendors" && result.vendors) {
    if (result.vendors.length === 0) return `No vendors found.${q}`;
    const lines = result.vendors.map(
      (v) => `• ${v.name} — ${v.email || "N/A"} (${v.phone || "N/A"})${v.category ? ` | ${v.category}` : ""}${v.city ? ` | ${v.city}` : ""}${v.website ? ` | ${v.website}` : ""}`,
    );
    return `Zoho CRM — Vendors (${result.total} found):\n${lines.join("\n")}${q}`;
  }

  if (result.contacts) {
    if (result.contacts.length === 0) return `No contacts found.${q}`;
    const lines = result.contacts.map(
      (c) => `• ${c.name} — ${c.email || "N/A"} (${c.phone || "N/A"})${c.title ? ` | ${c.title}` : ""}${c.account ? ` | ${c.account}` : ""}${c.department ? ` | ${c.department}` : ""}${c.mailingCity ? ` | ${c.mailingCity}` : ""}`,
    );
    return `Zoho CRM — Contacts (${result.total} found):\n${lines.join("\n")}${q}`;
  }

  return `No Zoho CRM data found.${q}`;
}
