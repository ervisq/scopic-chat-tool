import axios from "axios";
import { getZohoAccessToken } from "./zohoTokenManager";

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
}

const CONTRACTS_BASE = "https://contracts.zoho.com/api/v1";
const DEFAULT_LIMIT = 200;

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

export async function queryZohoContracts(
  query: string,
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  domain?: string,
): Promise<ZohoContractResult> {
  const accessToken = await getZohoAccessToken(clientId, clientSecret, refreshToken, domain);

  try {
    const response = await axios.get(`${CONTRACTS_BASE}/contracts`, {
      params: { limit: DEFAULT_LIMIT },
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });

    const records = response.data?.contracts || response.data?.data || [];
    const contracts = (Array.isArray(records) ? records : []).map(mapContract);

    const lower = query.toLowerCase();
    let filtered = contracts;

    if (lower.includes("active")) {
      filtered = contracts.filter((c) => c.contractStatus.toLowerCase().includes("active"));
    } else if (lower.includes("expired") || lower.includes("past")) {
      filtered = contracts.filter((c) => c.contractStatus.toLowerCase().includes("expired") || c.contractStatus.toLowerCase().includes("terminated"));
    } else if (lower.includes("pending") || lower.includes("draft")) {
      filtered = contracts.filter((c) => c.contractStatus.toLowerCase().includes("pending") || c.contractStatus.toLowerCase().includes("draft"));
    } else if (lower.includes("expiring")) {
      const now = new Date();
      const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      filtered = contracts.filter((c) => {
        if (!c.endDate) return false;
        const end = new Date(c.endDate);
        return end >= now && end <= thirtyDays;
      });
    }

    const searchTerms = lower.replace(/contracts?|show|list|find|get|all|active|expired|pending|draft|expiring/g, "").trim();
    if (searchTerms.length > 2) {
      const termFiltered = filtered.filter((c) =>
        c.contractName.toLowerCase().includes(searchTerms) ||
        c.company.toLowerCase().includes(searchTerms) ||
        c.contractType.toLowerCase().includes(searchTerms) ||
        c.contractOwner.toLowerCase().includes(searchTerms)
      );
      if (termFiltered.length > 0) filtered = termFiltered;
    }

    return { contracts: filtered, total: filtered.length, source: "live" };
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return { contracts: [], total: 0, source: "live" };
    }
    if (axios.isAxiosError(err) && [400, 401, 403].includes(err.response?.status || 0)) {
      throw new Error(
        "Zoho Contracts access denied — your Zoho connection may not include Contracts permissions. " +
        "Please go to Connected Services, click 'Update' on the Zoho card, and click 'Reconnect' to grant updated permissions."
      );
    }
    throw err;
  }
}

export function formatContractsResult(result: ZohoContractResult, query: string): string {
  const q = `\n\nQuery: "${query}"`;

  if (result.contracts.length === 0) return `No contracts found.${q}`;

  const lines = result.contracts.map(
    (c) => `• ${c.contractName} — [${c.contractStatus || "N/A"}] Type: ${c.contractType || "N/A"}${c.company ? ` | Company: ${c.company}` : ""}${c.contractValue ? ` | Value: ${c.contractValue}` : ""}${c.startDate ? ` | Start: ${c.startDate}` : ""}${c.endDate ? ` | End: ${c.endDate}` : ""}${c.contractOwner ? ` | Owner: ${c.contractOwner}` : ""}`,
  );
  return `Zoho Contracts (${result.total} found):\n${lines.join("\n")}${q}`;
}
