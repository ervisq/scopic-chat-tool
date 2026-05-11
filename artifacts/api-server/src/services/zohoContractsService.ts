import axios from "axios";
import { getZohoAccessToken, ZohoPermissionError } from "./zohoTokenManager";
import { getContractsBaseUrl } from "./zohoDomainUtils";

export interface ZohoContract {
  id: string;
  contractName: string;
  contractType: string;
  contractStatus: string;
  company: string;
  contractOwner: string;
  startDate: string;
  endDate: string;
  contractValue: string;
  description: string;
  createdTime: string;
}

export interface ZohoContractResult {
  contracts: ZohoContract[];
  total: number;
  source: "live" | "error";
  searchEntity?: string;
  statusFilter?: string;
  ownerFilter?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  dateField?: string;
}

export type ContractsDateField = "start_date" | "end_date" | "created_time";

export interface ContractsSearchOptions {
  searchEntity?: string;
  statusFilter?: string;
  ownerFilter?: "me" | "all";
  dateRangeStart?: string;
  dateRangeEnd?: string;
  dateField?: string;
  limit?: number;
}

const DEFAULT_LIMIT = 200;

const VALID_DATE_FIELDS = new Set<string>(["start_date", "end_date", "created_time"]);

const DATE_FIELD_TO_PROP: Record<string, keyof ZohoContract> = {
  start_date: "startDate",
  end_date: "endDate",
  created_time: "createdTime",
};

function str(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "object" && val !== null && "name" in val) return String((val as Record<string, unknown>).name || "");
  return String(val);
}

function mapContract(r: Record<string, unknown>): ZohoContract {
  const value = r.contract_value || r.Contract_Value || r.total_contract_value;
  return {
    id: str(r.id || r.contract_id),
    contractName: str(r.contract_name || r.Contract_Name || r.name),
    contractType: str(r.contract_type || r.Contract_Type || r.type),
    contractStatus: str(r.contract_status || r.Contract_Status || r.status),
    company: str(r.company_name || r.Company || r.counterparty || r.Counterparty),
    contractOwner: str(r.contract_owner || r.Contract_Owner || r.owner || r.Owner),
    startDate: str(r.start_date || r.Start_Date || r.effective_date),
    endDate: str(r.end_date || r.End_Date || r.expiry_date || r.Expiry_Date),
    contractValue: value ? `$${Number(value).toLocaleString()}` : "",
    description: str(r.description || r.Description),
    createdTime: str(r.created_time || r.Created_Time),
  };
}

async function fetchAllContracts(
  accessToken: string,
  contractsBase: string,
  limit: number = DEFAULT_LIMIT,
): Promise<ZohoContract[]> {
  const response = await axios.get(`${contractsBase}/contracts`, {
    params: { limit },
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });

  const records = response.data?.contracts || response.data?.data || [];
  return (Array.isArray(records) ? records : []).map(mapContract);
}

const DASHBOARD_FIELDS = [
  "id",
  "Contract_Name",
  "Contract_Type",
  "Contract_Status",
  "Company",
  "Start_Date",
  "End_Date",
  "Contract_Value",
].join(",");

export interface DashboardContractsSummary {
  activeCount: number;
  expiringCount: number;
  totalContracts: number;
  expiringContracts: Array<{
    id: string;
    contractName: string;
    contractType: string;
    contractStatus: string;
    company: string;
    startDate: string;
    endDate: string;
    contractValue: string;
  }>;
  contracts: Array<{
    id: string;
    contractName: string;
    contractType: string;
    contractStatus: string;
    company: string;
    startDate: string;
    endDate: string;
    contractValue: string;
  }>;
}

export async function getDashboardContractsSummary(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  domain?: string,
): Promise<DashboardContractsSummary> {
  const accessToken = await getZohoAccessToken(clientId, clientSecret, refreshToken, domain);
  const contractsBase = getContractsBaseUrl(domain || "https://accounts.zoho.com");

  const response = await axios.get(`${contractsBase}/contracts`, {
    params: { limit: DEFAULT_LIMIT, fields: DASHBOARD_FIELDS },
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });

  const records = response.data?.contracts || response.data?.data || [];
  const all: ZohoContract[] = (Array.isArray(records) ? records : []).map(mapContract);

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

  const expiringSorted = [...expiring].sort((a, b) => {
    const ad = a.endDate ? new Date(a.endDate).getTime() : Infinity;
    const bd = b.endDate ? new Date(b.endDate).getTime() : Infinity;
    return ad - bd;
  });

  const trim = (c: ZohoContract) => ({
    id: c.id,
    contractName: c.contractName,
    contractType: c.contractType,
    contractStatus: c.contractStatus,
    company: c.company,
    startDate: c.startDate,
    endDate: c.endDate,
    contractValue: c.contractValue,
  });

  const previewSource = activeContracts.length > 0 ? activeContracts : all;

  return {
    activeCount: activeContracts.length,
    expiringCount: expiring.length,
    totalContracts: all.length,
    expiringContracts: expiringSorted.slice(0, 5).map(trim),
    contracts: previewSource.slice(0, 8).map(trim),
  };
}

function filterByEntity(
  contracts: ZohoContract[],
  searchEntity: string,
): ZohoContract[] {
  const lower = searchEntity.toLowerCase();
  return contracts.filter((c) =>
    c.contractName.toLowerCase().includes(lower) ||
    c.company.toLowerCase().includes(lower) ||
    c.contractType.toLowerCase().includes(lower) ||
    c.contractOwner.toLowerCase().includes(lower)
  );
}

function filterByStatus(
  contracts: ZohoContract[],
  statusFilter: string,
  hasExplicitDateRange: boolean,
): ZohoContract[] {
  const lower = statusFilter.toLowerCase();

  if (lower === "expiring") {
    const excludeStatuses = new Set(["expired", "terminated"]);
    const base = contracts.filter((c) =>
      c.endDate && !excludeStatuses.has(c.contractStatus.toLowerCase())
    );

    if (hasExplicitDateRange) {
      return base;
    }

    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return base.filter((c) => {
      const end = new Date(c.endDate);
      return end >= now && end <= thirtyDays;
    });
  }

  return contracts.filter((c) =>
    c.contractStatus.toLowerCase() === lower
  );
}

function filterByDate(
  contracts: ZohoContract[],
  dateField: string,
  dateStart: string,
  dateEnd: string,
): ZohoContract[] {
  const prop = DATE_FIELD_TO_PROP[dateField] || "createdTime";
  const start = new Date(dateStart);
  const end = new Date(dateEnd + "T23:59:59");

  return contracts.filter((c) => {
    const val = c[prop];
    if (!val) return false;
    const d = new Date(val);
    return d >= start && d <= end;
  });
}

function filterByOwner(
  contracts: ZohoContract[],
  ownerContracts: ZohoContract[] | null,
): ZohoContract[] {
  if (ownerContracts === null) return [];
  const ownerIds = new Set(ownerContracts.map((c) => c.id));
  return contracts.filter((c) => ownerIds.has(c.id));
}

export async function queryZohoContracts(
  query: string,
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  domain?: string,
  options?: ContractsSearchOptions,
): Promise<ZohoContractResult> {
  const accessToken = await getZohoAccessToken(clientId, clientSecret, refreshToken, domain);
  const contractsBase = getContractsBaseUrl(domain || "https://accounts.zoho.com");

  const searchEntity = options?.searchEntity || undefined;
  const statusFilter = options?.statusFilter || undefined;
  const rawDateField = options?.dateField || "created_time";
  const dateField = VALID_DATE_FIELDS.has(rawDateField) ? rawDateField : "created_time";
  const dateStart = options?.dateRangeStart || undefined;
  const dateEnd = options?.dateRangeEnd || undefined;
  const hasDateFilter = !!(dateStart && dateEnd);
  const wantOwnerFilter = options?.ownerFilter === "me";

  const filterContext: Partial<ZohoContractResult> = {};
  if (searchEntity) filterContext.searchEntity = searchEntity;
  if (statusFilter) filterContext.statusFilter = statusFilter;
  if (hasDateFilter) {
    filterContext.dateRangeStart = dateStart!;
    filterContext.dateRangeEnd = dateEnd!;
    filterContext.dateField = dateField;
  }
  if (wantOwnerFilter) filterContext.ownerFilter = "me";

  console.log(`[ZohoContracts] searchEntity: ${searchEntity || "(none)"}, statusFilter: ${statusFilter || "(none)"}, ownerFilter: ${wantOwnerFilter}, dateFilter: ${hasDateFilter ? `${dateField} ${dateStart}→${dateEnd}` : "none"}`);

  try {
    const fetchLimit = options?.limit && options.limit > 0 ? Math.min(options.limit, DEFAULT_LIMIT) : DEFAULT_LIMIT;
    const allContracts = await fetchAllContracts(accessToken, contractsBase, fetchLimit);
    console.log(`[ZohoContracts] Fetched ${allContracts.length} contracts`);
    let filtered = allContracts;

    if (searchEntity) {
      filtered = filterByEntity(filtered, searchEntity);
      console.log(`[ZohoContracts] Entity filter "${searchEntity}": ${allContracts.length} → ${filtered.length}`);
    }

    if (statusFilter) {
      const beforeCount = filtered.length;
      filtered = filterByStatus(filtered, statusFilter, hasDateFilter);
      console.log(`[ZohoContracts] Status filter "${statusFilter}": ${beforeCount} → ${filtered.length}`);
    }

    if (hasDateFilter) {
      const beforeCount = filtered.length;
      filtered = filterByDate(filtered, dateField, dateStart!, dateEnd!);
      console.log(`[ZohoContracts] Date filter ${dateField} ${dateStart}→${dateEnd}: ${beforeCount} → ${filtered.length}`);
    }

    if (wantOwnerFilter) {
      const beforeCount = filtered.length;
      try {
        const ownerResponse = await axios.get(`${contractsBase}/contracts`, {
          params: { limit: DEFAULT_LIMIT, owner: "CURRENTUSER" },
          headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
        });
        const ownerRecords = ownerResponse.data?.contracts || ownerResponse.data?.data || [];
        const ownerContracts = (Array.isArray(ownerRecords) ? ownerRecords : []).map(mapContract);
        filtered = filterByOwner(filtered, ownerContracts);
        console.log(`[ZohoContracts] Owner filter: ${beforeCount} → ${filtered.length}`);
      } catch (ownerErr) {
        console.log(`[ZohoContracts] Owner filter API failed — returning empty to avoid unfiltered data`);
        filtered = [];
      }
    }

    return { contracts: filtered, total: filtered.length, source: "live", ...filterContext };
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return { contracts: [], total: 0, source: "live", ...filterContext };
    }
    if (axios.isAxiosError(err) && [400, 401, 403].includes(err.response?.status || 0)) {
      throw new ZohoPermissionError(
        "Zoho Contracts access denied — your Zoho connection may not include Contracts permissions.",
        err.response?.status || 401,
      );
    }
    throw err;
  }
}

export function formatContractsResult(result: ZohoContractResult, query: string): string {
  const q = `\n\nQuery: "${query}"`;

  const contextParts: string[] = [];
  if (result.searchEntity) contextParts.push(`Search: "${result.searchEntity}"`);
  if (result.statusFilter) contextParts.push(`Status filter: ${result.statusFilter}`);
  if (result.dateRangeStart && result.dateRangeEnd) {
    contextParts.push(`Date filter: ${result.dateField || "created_time"} from ${result.dateRangeStart} to ${result.dateRangeEnd}`);
  }
  if (result.ownerFilter) contextParts.push(`Owner filter: ${result.ownerFilter}`);
  const filterNote = contextParts.length > 0 ? `\n${contextParts.join(" | ")}` : "";

  if (result.contracts.length === 0) return `No contracts found.${filterNote}${q}`;

  const lines = result.contracts.map(
    (c) => `• ${c.contractName} — [${c.contractStatus || "N/A"}] Type: ${c.contractType || "N/A"}${c.company ? ` | Company: ${c.company}` : ""}${c.contractValue ? ` | Value: ${c.contractValue}` : ""}${c.startDate ? ` | Start: ${c.startDate}` : ""}${c.endDate ? ` | End: ${c.endDate}` : ""}${c.contractOwner ? ` | Owner: ${c.contractOwner}` : ""}`,
  );
  return `Zoho Contracts (${result.total} found):\n${lines.join("\n")}${filterNote}${q}`;
}
