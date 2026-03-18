import axios from "axios";
import { getZohoAccessToken } from "./zohoTokenManager";

export interface ZohoLead {
  id: string;
  name: string;
  company: string;
  email: string;
  status: string;
  source: string;
}

export interface ZohoContact {
  id: string;
  name: string;
  email: string;
  phone: string;
  account: string;
}

export interface ZohoDeal {
  id: string;
  name: string;
  stage: string;
  amount: string;
  closingDate: string;
  account: string;
}

export interface ZohoAccount {
  id: string;
  name: string;
  industry: string;
  phone: string;
  website: string;
}

export interface ZohoCrmResult {
  type: "leads" | "contacts" | "deals" | "accounts";
  leads?: ZohoLead[];
  contacts?: ZohoContact[];
  deals?: ZohoDeal[];
  accounts?: ZohoAccount[];
  total: number;
  source: "live" | "error";
}

const CRM_BASE = "https://www.zohoapis.com";

async function fetchModule<T>(
  accessToken: string,
  module: string,
  mapper: (record: Record<string, string>) => T,
): Promise<T[]> {
  const response = await axios.get(`${CRM_BASE}/crm/v7/${module}`, {
    params: { per_page: 20 },
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });

  const records = response.data?.data || [];
  return records.map(mapper);
}

function mapLead(r: Record<string, string>): ZohoLead {
  return {
    id: r.id || "",
    name: `${r.First_Name || ""} ${r.Last_Name || ""}`.trim() || r.Full_Name || "",
    company: r.Company || "",
    email: r.Email || "",
    status: r.Lead_Status || "",
    source: r.Lead_Source || "",
  };
}

function mapContact(r: Record<string, string>): ZohoContact {
  return {
    id: r.id || "",
    name: `${r.First_Name || ""} ${r.Last_Name || ""}`.trim() || r.Full_Name || "",
    email: r.Email || "",
    phone: r.Phone || "",
    account: r.Account_Name?.name || r.Account_Name || "",
  };
}

function mapDeal(r: Record<string, string>): ZohoDeal {
  return {
    id: r.id || "",
    name: r.Deal_Name || "",
    stage: r.Stage || "",
    amount: r.Amount ? `$${Number(r.Amount).toLocaleString()}` : "N/A",
    closingDate: r.Closing_Date || "",
    account: r.Account_Name?.name || r.Account_Name || "",
  };
}

function mapAccount(r: Record<string, string>): ZohoAccount {
  return {
    id: r.id || "",
    name: r.Account_Name || "",
    industry: r.Industry || "",
    phone: r.Phone || "",
    website: r.Website || "",
  };
}

export async function queryZohoCrm(
  query: string,
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  domain?: string,
): Promise<ZohoCrmResult> {
  const accessToken = await getZohoAccessToken(clientId, clientSecret, refreshToken, domain);
  const lower = query.toLowerCase();

  if (lower.includes("lead")) {
    const leads = await fetchModule(accessToken, "Leads", mapLead);
    return { type: "leads", leads, total: leads.length, source: "live" };
  }

  if (lower.includes("deal") || lower.includes("pipeline") || lower.includes("opportunity")) {
    const deals = await fetchModule(accessToken, "Deals", mapDeal);
    return { type: "deals", deals, total: deals.length, source: "live" };
  }

  if (lower.includes("account") || lower.includes("company") || lower.includes("organization")) {
    const accounts = await fetchModule(accessToken, "Accounts", mapAccount);
    return { type: "accounts", accounts, total: accounts.length, source: "live" };
  }

  const contacts = await fetchModule(accessToken, "Contacts", mapContact);
  return { type: "contacts", contacts, total: contacts.length, source: "live" };
}

export function formatCrmResult(result: ZohoCrmResult, query: string): string {
  if (result.type === "leads" && result.leads) {
    if (result.leads.length === 0) return `No leads found.\n\nQuery: "${query}"`;
    const lines = result.leads.map(
      (l) => `• ${l.name} — ${l.company} (${l.email}) [${l.status}] Source: ${l.source}`,
    );
    return `Zoho CRM — Leads (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
  }

  if (result.type === "deals" && result.deals) {
    if (result.deals.length === 0) return `No deals found.\n\nQuery: "${query}"`;
    const lines = result.deals.map(
      (d) => `• ${d.name} — ${d.stage} (${d.amount}) Close: ${d.closingDate} [${d.account}]`,
    );
    return `Zoho CRM — Deals (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
  }

  if (result.type === "accounts" && result.accounts) {
    if (result.accounts.length === 0) return `No accounts found.\n\nQuery: "${query}"`;
    const lines = result.accounts.map(
      (a) => `• ${a.name} — ${a.industry} (${a.phone}) ${a.website}`,
    );
    return `Zoho CRM — Accounts (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
  }

  if (result.contacts) {
    if (result.contacts.length === 0) return `No contacts found.\n\nQuery: "${query}"`;
    const lines = result.contacts.map(
      (c) => `• ${c.name} — ${c.email} (${c.phone}) [${c.account}]`,
    );
    return `Zoho CRM — Contacts (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
  }

  return `No Zoho CRM data found.\n\nQuery: "${query}"`;
}
