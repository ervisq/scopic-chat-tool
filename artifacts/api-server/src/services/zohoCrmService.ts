import axios from "axios";
import { getZohoAccessToken, ZohoPermissionError } from "./zohoTokenManager";
import { getCrmBaseUrl } from "./zohoDomainUtils";

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
  relatedContacts?: ZohoContact[];
  relatedDeals?: ZohoDeal[];
  relatedTasks?: ZohoTask[];
  relatedLeads?: ZohoLead[];
  total: number;
  source: "live" | "error";
  searchEntity?: string;
}

export interface CrmSearchOptions {
  searchEntity?: string;
  ownerFilter?: "me" | "all";
  includeRelated?: boolean;
  module?: CrmResultType | string;
  isAtMentionOverride?: boolean;
}

const DEFAULT_LIMIT = 200;

const MODULE_FIELDS: Record<string, string> = {
  Leads: "id,First_Name,Last_Name,Full_Name,Company,Email,Phone,Mobile,Lead_Status,Lead_Source,Created_Time",
  Contacts: "id,First_Name,Last_Name,Full_Name,Email,Phone,Mobile,Account_Name,Title,Department,Mailing_City",
  Deals: "id,Deal_Name,Stage,Amount,Closing_Date,Account_Name,Contact_Name,Probability,Type",
  Accounts: "id,Account_Name,Industry,Phone,Website,Annual_Revenue,Employees,Billing_City,Account_Type",
  Tasks: "id,Subject,Status,Priority,Due_Date,What_Id,$se_module,Owner,Description",
  Events: "id,Event_Title,Start_DateTime,End_DateTime,Location,Participants,Description",
  Calls: "id,Subject,Call_Type,Call_Duration,Call_Start_Time,What_Id,Who_Id,Call_Result",
  Products: "id,Product_Name,Product_Code,Unit_Price,Product_Category,Manufacturer,Product_Active",
  Quotes: "id,Subject,Quote_Stage,Grand_Total,Valid_Till,Account_Name,Contact_Name",
  Invoices: "id,Subject,Status,Grand_Total,Due_Date,Account_Name,Invoice_Date",
  Campaigns: "id,Campaign_Name,Type,Status,Start_Date,End_Date,Expected_Revenue,Budgeted_Cost",
  Vendors: "id,Vendor_Name,Email,Phone,Category,City,Website",
};

async function fetchModule<T>(
  accessToken: string,
  module: string,
  mapper: (record: Record<string, unknown>) => T,
  crmBase: string,
  params?: Record<string, string>,
): Promise<T[]> {
  const headers = { Authorization: `Zoho-oauthtoken ${accessToken}` };
  const fields = MODULE_FIELDS[module];
  const queryParams: Record<string, unknown> = { per_page: DEFAULT_LIMIT, ...params };
  if (fields) {
    queryParams.fields = fields;
  }

  console.log(`[ZohoCRM] Fetching ${module} from ${crmBase}/crm/v7/${module}`);

  try {
    const response = await axios.get(`${crmBase}/crm/v7/${module}`, {
      params: queryParams,
      headers,
    });
    const records = response.data?.data || [];
    console.log(`[ZohoCRM] v7 ${module} returned ${records.length} records`);
    if (records.length > 0) {
      console.log(`[ZohoCRM] v7 ${module} first record keys:`, Object.keys(records[0]).slice(0, 15));
    }
    return records.map(mapper);
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status || 0;
      console.error(`[ZohoCRM] v7 ${module} failed (${status}):`, JSON.stringify(err.response?.data || {}).substring(0, 300));

      if ([401, 403].includes(status)) {
        throw new ZohoPermissionError(
          "Zoho CRM access denied — your Zoho connection may not include CRM permissions.",
          status,
        );
      }

      if (status === 204) {
        return [];
      }

      try {
        console.log(`[ZohoCRM] Trying v2 fallback for ${module}...`);
        const fallback = await axios.get(`${crmBase}/crm/v2/${module}`, {
          params: { per_page: DEFAULT_LIMIT, ...params },
          headers,
        });
        const records = fallback.data?.data || [];
        console.log(`[ZohoCRM] v2 ${module} returned ${records.length} records`);
        return records.map(mapper);
      } catch (v2Err: unknown) {
        if (axios.isAxiosError(v2Err) && [401, 403].includes(v2Err.response?.status || 0)) {
          throw new ZohoPermissionError(
            "Zoho CRM access denied — your Zoho connection may not include CRM permissions.",
            v2Err.response?.status || 401,
          );
        }
        console.error(`[ZohoCRM] v2 fallback also failed:`, axios.isAxiosError(v2Err) ? v2Err.response?.status : String(v2Err));
      }
    }
    throw err;
  }
}

async function searchModuleByWord<T>(
  accessToken: string,
  module: string,
  word: string,
  mapper: (record: Record<string, unknown>) => T,
  crmBase: string,
): Promise<T[] | null> {
  const headers = { Authorization: `Zoho-oauthtoken ${accessToken}` };

  try {
    console.log(`[ZohoCRM] Searching ${module} for word "${word}" via ${crmBase}/crm/v7/${module}/search`);
    const response = await axios.get(`${crmBase}/crm/v7/${module}/search`, {
      params: { word, per_page: DEFAULT_LIMIT },
      headers,
    });
    const records = response.data?.data || [];
    console.log(`[ZohoCRM] Search ${module} for "${word}" returned ${records.length} records`);
    return records.map(mapper);
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status || 0;
      if ([401, 403].includes(status)) {
        throw new ZohoPermissionError(
          "Zoho CRM access denied — your Zoho connection may not include CRM permissions.",
          status,
        );
      }
      if (status === 204) {
        console.log(`[ZohoCRM] Search ${module} for "${word}" returned no results (204)`);
        return [];
      }
      console.error(`[ZohoCRM] Search ${module} failed (${status}):`, JSON.stringify(err.response?.data || {}).substring(0, 200));
    }
    return null;
  }
}

async function searchModuleByCriteria<T>(
  accessToken: string,
  module: string,
  criteria: string,
  mapper: (record: Record<string, unknown>) => T,
  crmBase: string,
): Promise<T[] | null> {
  const headers = { Authorization: `Zoho-oauthtoken ${accessToken}` };

  try {
    console.log(`[ZohoCRM] Criteria search ${module}: ${criteria}`);
    const response = await axios.get(`${crmBase}/crm/v7/${module}/search`, {
      params: { criteria, per_page: DEFAULT_LIMIT },
      headers,
    });
    const records = response.data?.data || [];
    console.log(`[ZohoCRM] Criteria search ${module} returned ${records.length} records`);
    return records.map(mapper);
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status || 0;
      if ([401, 403].includes(status)) {
        throw new ZohoPermissionError(
          "Zoho CRM access denied — your Zoho connection may not include CRM permissions.",
          status,
        );
      }
      if (status === 204) {
        console.log(`[ZohoCRM] Criteria search ${module} returned no results (204)`);
        return [];
      }
      console.error(`[ZohoCRM] Criteria search ${module} failed (${status}):`, JSON.stringify(err.response?.data || {}).substring(0, 200));
    }
    return null;
  }
}

const GENERIC_WORDS = new Set([
  "my", "all", "list", "show", "get", "find", "what", "which", "the",
  "recent", "latest", "open", "any", "every", "a", "an", "me", "i",
  "tasks", "leads", "contacts", "deals", "accounts", "events",
  "calls", "products", "quotes", "invoices", "campaigns", "vendors",
  "task", "lead", "contact", "deal", "account", "event",
  "call", "product", "quote", "invoice", "campaign", "vendor",
  "owned", "by", "created", "assigned", "to", "for", "from",
  "this", "last", "next", "week", "month", "today", "yesterday",
  "crm", "zoho", "zohocrm", "in", "there", "here", "data", "info",
  "person", "people", "activity", "activities", "website", "details",
  "history", "information", "status", "about", "everything", "name",
  "number", "email", "address", "phone", "related", "associated",
  "with", "on", "at", "is", "are", "has", "have", "do", "does",
  "who", "how", "many", "much", "their", "its", "of", "or", "and",
  "can", "could", "would", "should", "please", "tell", "give",
  "look", "up", "check", "search", "query",
]);

function extractSearchTermFallback(query: string): string | null {
  const cleaned = query
    .replace(/@[a-zA-Z0-9_-]+/g, "")
    .replace(/[?!.,;:]+/g, " ")
    .trim();

  const words = cleaned.split(/\s+/).filter((w) => !GENERIC_WORDS.has(w.toLowerCase()));
  if (words.length === 0) return null;

  const searchTerm = words.join(" ").trim();
  if (searchTerm.length < 2) return null;

  return searchTerm;
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

const MODULE_NAME_MAP: Record<CrmResultType, string> = {
  leads: "Leads", contacts: "Contacts", deals: "Deals", accounts: "Accounts",
  tasks: "Tasks", events: "Events", calls: "Calls", products: "Products",
  quotes: "Quotes", invoices: "Invoices", campaigns: "Campaigns", vendors: "Vendors",
};

type MapperFn = (r: Record<string, unknown>) => unknown;

const MODULE_MAPPER_MAP: Record<CrmResultType, MapperFn> = {
  leads: mapLead, contacts: mapContact, deals: mapDeal, accounts: mapAccount,
  tasks: mapTask, events: mapEvent, calls: mapCall, products: mapProduct,
  quotes: mapQuote, invoices: mapInvoice, campaigns: mapCampaign, vendors: mapVendor,
};

const RELATED_MODULES: Record<CrmResultType, CrmResultType[]> = {
  accounts: ["contacts", "deals", "tasks"],
  contacts: ["deals", "tasks"],
  leads: ["tasks"],
  deals: ["contacts", "tasks"],
  tasks: [],
  events: [],
  calls: [],
  products: [],
  quotes: [],
  invoices: [],
  campaigns: [],
  vendors: [],
};

async function fetchRelatedRecords(
  accessToken: string,
  crmBase: string,
  searchEntity: string,
  primaryModule: CrmResultType,
): Promise<Pick<ZohoCrmResult, "relatedContacts" | "relatedDeals" | "relatedTasks" | "relatedLeads">> {
  const related: Pick<ZohoCrmResult, "relatedContacts" | "relatedDeals" | "relatedTasks" | "relatedLeads"> = {};
  const modulesToSearch = RELATED_MODULES[primaryModule] || [];

  const promises = modulesToSearch.map(async (modType) => {
    const modName = MODULE_NAME_MAP[modType];
    const mapper = MODULE_MAPPER_MAP[modType];
    const results = await searchModuleByWord(accessToken, modName, searchEntity, mapper, crmBase);
    return { modType, results };
  });

  const results = await Promise.all(promises);

  for (const { modType, results: records } of results) {
    if (!records || records.length === 0) continue;
    switch (modType) {
      case "contacts":
        related.relatedContacts = records as ZohoContact[];
        break;
      case "deals":
        related.relatedDeals = records as ZohoDeal[];
        break;
      case "tasks":
        related.relatedTasks = records as ZohoTask[];
        break;
      case "leads":
        related.relatedLeads = records as ZohoLead[];
        break;
    }
  }

  return related;
}

const VALID_MODULES = new Set<CrmResultType>([
  "leads", "contacts", "deals", "accounts", "tasks", "events",
  "calls", "products", "quotes", "invoices", "campaigns", "vendors",
]);

function isValidModule(mod: string): mod is CrmResultType {
  return VALID_MODULES.has(mod as CrmResultType);
}

function buildResult(moduleType: CrmResultType, records: unknown[], extra?: Partial<ZohoCrmResult>): ZohoCrmResult {
  const base: ZohoCrmResult = { type: moduleType, total: records.length, source: "live", ...extra };
  switch (moduleType) {
    case "leads": base.leads = records as ZohoLead[]; break;
    case "contacts": base.contacts = records as ZohoContact[]; break;
    case "deals": base.deals = records as ZohoDeal[]; break;
    case "accounts": base.accounts = records as ZohoAccount[]; break;
    case "tasks": base.tasks = records as ZohoTask[]; break;
    case "events": base.events = records as ZohoEvent[]; break;
    case "calls": base.calls = records as ZohoCall[]; break;
    case "products": base.products = records as ZohoProduct[]; break;
    case "quotes": base.quotes = records as ZohoQuote[]; break;
    case "invoices": base.invoices = records as ZohoInvoice[]; break;
    case "campaigns": base.campaigns = records as ZohoCampaign[]; break;
    case "vendors": base.vendors = records as ZohoVendor[]; break;
  }
  return base;
}

function detectOwnerIntent(query: string): boolean {
  const lower = query.toLowerCase();
  return /\b(my |i own|assigned to me|i am assigned|my own)\b/.test(lower);
}

export async function queryZohoCrm(
  query: string,
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  domain?: string,
  options?: CrmSearchOptions,
): Promise<ZohoCrmResult> {
  const accessToken = await getZohoAccessToken(clientId, clientSecret, refreshToken, domain);
  const crmBase = getCrmBaseUrl(domain || "https://accounts.zoho.com");
  console.log(`[ZohoCRM] Using CRM base URL: ${crmBase} (accountsDomain: ${domain})`);

  const rawModule = options?.module || "";
  const moduleType: CrmResultType = isValidModule(rawModule) ? rawModule : detectCrmModule(query);
  const moduleName = MODULE_NAME_MAP[moduleType];
  const mapper = MODULE_MAPPER_MAP[moduleType] as (r: Record<string, unknown>) => unknown;

  let searchEntity = options?.searchEntity || (options?.isAtMentionOverride ? extractSearchTermFallback(query) : null);
  const wantOwnerFilter = options?.ownerFilter === "me" || detectOwnerIntent(query);
  const wantRelated = options?.includeRelated === true || (options?.isAtMentionOverride === true && !!searchEntity);

  if (!searchEntity && wantRelated && query.trim().length > 0) {
    searchEntity = query.trim();
    console.log(`[ZohoCRM] No search_entity but include_related requested — using query as entity: "${searchEntity}"`);
  }

  console.log(`[ZohoCRM] Module: ${moduleName}, searchEntity: ${searchEntity || "(none)"}, ownerFilter: ${wantOwnerFilter}, includeRelated: ${wantRelated}`);

  if (wantOwnerFilter) {
    console.log(`[ZohoCRM] Owner filter requested — using criteria search`);
    const criteriaResults = await searchModuleByCriteria(
      accessToken,
      moduleName,
      "(Owner:equals:${CURRENTUSER})",
      mapper,
      crmBase,
    );

    if (criteriaResults !== null) {
      return buildResult(moduleType, criteriaResults);
    }

    console.log(`[ZohoCRM] Owner criteria search not supported — returning empty result to avoid exposing unfiltered data`);
    return buildResult(moduleType, []);
  }

  if (searchEntity) {
    console.log(`[ZohoCRM] Searching ${moduleName} for entity: "${searchEntity}"`);
    const searchResults = await searchModuleByWord(accessToken, moduleName, searchEntity, mapper, crmBase);

    if (searchResults !== null) {
      const result = buildResult(moduleType, searchResults, { searchEntity });

      if (wantRelated && searchResults.length > 0) {
        const relatedData = await fetchRelatedRecords(accessToken, crmBase, searchEntity, moduleType);
        Object.assign(result, relatedData);
        const relatedCount = (relatedData.relatedContacts?.length || 0) +
          (relatedData.relatedDeals?.length || 0) +
          (relatedData.relatedTasks?.length || 0) +
          (relatedData.relatedLeads?.length || 0);
        console.log(`[ZohoCRM] Found ${searchResults.length} primary + ${relatedCount} related records for "${searchEntity}"`);
      }

      return result;
    }

    console.log(`[ZohoCRM] Search for "${searchEntity}" returned null, falling back to fetch all`);
  }

  const records = await fetchModule(accessToken, moduleName, mapper, crmBase);
  return buildResult(moduleType, records);
}

function formatSection(label: string, lines: string[]): string {
  if (lines.length === 0) return "";
  return `\n\n--- Related ${label} (${lines.length}) ---\n${lines.join("\n")}`;
}

export function formatCrmResult(result: ZohoCrmResult, query: string): string {
  const q = `\n\nQuery: "${query}"`;
  let main = "";

  if (result.type === "leads" && result.leads) {
    if (result.leads.length === 0) main = `No leads found.`;
    else {
      const lines = result.leads.map(
        (l) => `• ${l.name} — ${l.company} (${l.email}${l.phone ? ` | ${l.phone}` : ""}) [${l.status}] Source: ${l.source}`,
      );
      main = `Zoho CRM — Leads (${result.leads.length} found):\n${lines.join("\n")}`;
    }
  } else if (result.type === "deals" && result.deals) {
    if (result.deals.length === 0) main = `No deals found.`;
    else {
      const lines = result.deals.map(
        (d) => `• ${d.name} — ${d.stage} (${d.amount}) Close: ${d.closingDate} [${d.account}]${d.probability ? ` ${d.probability} prob` : ""}${d.contactName ? ` Contact: ${d.contactName}` : ""}`,
      );
      main = `Zoho CRM — Deals (${result.deals.length} found):\n${lines.join("\n")}`;
    }
  } else if (result.type === "accounts" && result.accounts) {
    if (result.accounts.length === 0) main = `No accounts found.`;
    else {
      const lines = result.accounts.map(
        (a) => `• ${a.name} — ${a.industry || "N/A"} (${a.phone || "N/A"}) ${a.website || ""}${a.annualRevenue ? ` Revenue: ${a.annualRevenue}` : ""}${a.employees ? ` | ${a.employees} employees` : ""}${a.billingCity ? ` | ${a.billingCity}` : ""} [${a.accountType || "N/A"}]`,
      );
      main = `Zoho CRM — Accounts (${result.accounts.length} found):\n${lines.join("\n")}`;
    }
  } else if (result.type === "tasks" && result.tasks) {
    if (result.tasks.length === 0) main = `No tasks found.`;
    else {
      const lines = result.tasks.map(
        (t) => `• ${t.subject} — [${t.status}] Priority: ${t.priority || "Normal"} Due: ${t.dueDate || "N/A"}${t.assignedTo ? ` | Assigned: ${t.assignedTo}` : ""}`,
      );
      main = `Zoho CRM — Tasks (${result.tasks.length} found):\n${lines.join("\n")}`;
    }
  } else if (result.type === "events" && result.events) {
    if (result.events.length === 0) main = `No events found.`;
    else {
      const lines = result.events.map(
        (e) => `• ${e.title} — ${e.startDateTime} to ${e.endDateTime}${e.location ? ` @ ${e.location}` : ""}${e.participants ? ` | With: ${e.participants}` : ""}`,
      );
      main = `Zoho CRM — Events/Meetings (${result.events.length} found):\n${lines.join("\n")}`;
    }
  } else if (result.type === "calls" && result.calls) {
    if (result.calls.length === 0) main = `No calls found.`;
    else {
      const lines = result.calls.map(
        (c) => `• ${c.subject} — ${c.callType} (${c.callDuration || "N/A"}) ${c.callStartTime || ""}${c.contactName ? ` | ${c.contactName}` : ""} [${c.callResult || "N/A"}]`,
      );
      main = `Zoho CRM — Calls (${result.calls.length} found):\n${lines.join("\n")}`;
    }
  } else if (result.type === "products" && result.products) {
    if (result.products.length === 0) main = `No products found.`;
    else {
      const lines = result.products.map(
        (p) => `• ${p.name}${p.productCode ? ` (${p.productCode})` : ""} — ${p.unitPrice || "N/A"}${p.category ? ` | ${p.category}` : ""}${p.manufacturer ? ` | ${p.manufacturer}` : ""} [${p.isActive ? "Active" : "Inactive"}]`,
      );
      main = `Zoho CRM — Products (${result.products.length} found):\n${lines.join("\n")}`;
    }
  } else if (result.type === "quotes" && result.quotes) {
    if (result.quotes.length === 0) main = `No quotes found.`;
    else {
      const lines = result.quotes.map(
        (q2) => `• ${q2.subject} — ${q2.stage || "N/A"} (${q2.grandTotal || "N/A"}) Valid till: ${q2.validTill || "N/A"} [${q2.account || "N/A"}]`,
      );
      main = `Zoho CRM — Quotes (${result.quotes.length} found):\n${lines.join("\n")}`;
    }
  } else if (result.type === "invoices" && result.invoices) {
    if (result.invoices.length === 0) main = `No invoices found.`;
    else {
      const lines = result.invoices.map(
        (inv) => `• ${inv.subject} — ${inv.grandTotal || "N/A"} [${inv.status}] Due: ${inv.dueDate || "N/A"} | Issued: ${inv.invoiceDate || "N/A"} [${inv.account || "N/A"}]`,
      );
      main = `Zoho CRM — Invoices (${result.invoices.length} found):\n${lines.join("\n")}`;
    }
  } else if (result.type === "campaigns" && result.campaigns) {
    if (result.campaigns.length === 0) main = `No campaigns found.`;
    else {
      const lines = result.campaigns.map(
        (c) => `• ${c.name} — ${c.type || "N/A"} [${c.status}] ${c.startDate || ""} to ${c.endDate || ""}${c.expectedRevenue ? ` | Expected: ${c.expectedRevenue}` : ""}${c.budgetedCost ? ` | Budget: ${c.budgetedCost}` : ""}`,
      );
      main = `Zoho CRM — Campaigns (${result.campaigns.length} found):\n${lines.join("\n")}`;
    }
  } else if (result.type === "vendors" && result.vendors) {
    if (result.vendors.length === 0) main = `No vendors found.`;
    else {
      const lines = result.vendors.map(
        (v) => `• ${v.name} — ${v.email || "N/A"} (${v.phone || "N/A"})${v.category ? ` | ${v.category}` : ""}${v.city ? ` | ${v.city}` : ""}${v.website ? ` | ${v.website}` : ""}`,
      );
      main = `Zoho CRM — Vendors (${result.vendors.length} found):\n${lines.join("\n")}`;
    }
  } else if (result.contacts) {
    if (result.contacts.length === 0) main = `No contacts found.`;
    else {
      const lines = result.contacts.map(
        (c) => `• ${c.name} — ${c.email || "N/A"} (${c.phone || "N/A"})${c.title ? ` | ${c.title}` : ""}${c.account ? ` | ${c.account}` : ""}${c.department ? ` | ${c.department}` : ""}${c.mailingCity ? ` | ${c.mailingCity}` : ""}`,
      );
      main = `Zoho CRM — Contacts (${result.contacts.length} found):\n${lines.join("\n")}`;
    }
  } else {
    main = `No Zoho CRM data found.`;
  }

  let relatedText = "";
  if (result.relatedContacts && result.relatedContacts.length > 0) {
    relatedText += formatSection("Contacts", result.relatedContacts.map(
      (c) => `• ${c.name} — ${c.email || "N/A"} (${c.phone || "N/A"})${c.title ? ` | ${c.title}` : ""}${c.account ? ` | ${c.account}` : ""}`,
    ));
  }
  if (result.relatedDeals && result.relatedDeals.length > 0) {
    relatedText += formatSection("Deals", result.relatedDeals.map(
      (d) => `• ${d.name} — ${d.stage} (${d.amount}) Close: ${d.closingDate}${d.contactName ? ` Contact: ${d.contactName}` : ""}`,
    ));
  }
  if (result.relatedTasks && result.relatedTasks.length > 0) {
    relatedText += formatSection("Tasks", result.relatedTasks.map(
      (t) => `• ${t.subject} — [${t.status}] Priority: ${t.priority || "Normal"} Due: ${t.dueDate || "N/A"}`,
    ));
  }
  if (result.relatedLeads && result.relatedLeads.length > 0) {
    relatedText += formatSection("Leads", result.relatedLeads.map(
      (l) => `• ${l.name} — ${l.company} (${l.email}) [${l.status}]`,
    ));
  }

  return `${main}${relatedText}${q}`;
}
