import { getUserCredentials } from "../lib/credential-store";
import { queryZohoPeople, formatPeopleResult } from "./zohoPeopleService";
import { queryZohoCrm, formatCrmResult } from "./zohoCrmService";

export interface ZohoRouterResult {
  reply: string;
  source: "live" | "not_connected" | "module_disabled" | "error";
}

const PEOPLE_KEYWORDS = [
  "employee", "employees", "staff", "team", "people",
  "leave", "time off", "vacation", "pto", "absence",
  "attendance", "check-in", "checkin",
  "hr", "human resource",
  "department", "designation",
];

const CRM_KEYWORDS = [
  "lead", "leads", "prospect",
  "deal", "deals", "pipeline", "opportunity",
  "contact", "contacts",
  "account", "accounts", "company", "organization",
  "sales", "revenue", "crm",
  "customer",
];

function detectModule(query: string): "people" | "crm" | "ambiguous" {
  const lower = query.toLowerCase();
  const hasPeople = PEOPLE_KEYWORDS.some((kw) => lower.includes(kw));
  const hasCrm = CRM_KEYWORDS.some((kw) => lower.includes(kw));

  if (hasPeople && !hasCrm) return "people";
  if (hasCrm && !hasPeople) return "crm";
  if (hasPeople && hasCrm) return "crm";
  return "ambiguous";
}

export async function queryZoho(query: string, userId?: number): Promise<ZohoRouterResult> {
  if (!userId) {
    return {
      reply: "Your Zoho account is not connected. Please go to Connected Services (Settings icon) to link your Zoho credentials.",
      source: "not_connected",
    };
  }

  const cred = await getUserCredentials(userId, "zoho");
  if (!cred) {
    return {
      reply: "Your Zoho account is not connected. Please go to Connected Services (Settings icon) and click 'Connect with Zoho'.",
      source: "not_connected",
    };
  }

  const { credentials } = cred;
  const { refreshToken, modules } = credentials;

  const clientId = process.env.ZOHO_CLIENT_ID || "";
  const clientSecret = process.env.ZOHO_CLIENT_SECRET || "";

  if (!clientId || !clientSecret) {
    return {
      reply: "Zoho OAuth is not configured on this server. Please contact your administrator.",
      source: "error",
    };
  }

  if (!refreshToken) {
    return {
      reply: "Your Zoho connection is incomplete. Please reconnect via Connected Services (Settings icon).",
      source: "error",
    };
  }

  const enabledModules: string[] = Array.isArray(modules)
    ? modules
    : typeof modules === "string" && modules.length > 0
      ? modules.split(",").map((m: string) => m.trim())
      : [];
  const detectedModule = detectModule(query);
  const accountsDomain = "https://accounts.zoho.com";

  if (detectedModule === "people" || (detectedModule === "ambiguous" && enabledModules.includes("people") && !enabledModules.includes("crm"))) {
    if (!enabledModules.includes("people")) {
      return {
        reply: "You haven't enabled the Zoho People module. Go to Connected Services (Settings icon) and check the \"People\" checkbox to enable it.",
        source: "module_disabled",
      };
    }
    try {
      const result = await queryZohoPeople(query, clientId, clientSecret, refreshToken, accountsDomain);
      return { reply: formatPeopleResult(result, query), source: "live" };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Zoho People API error:", msg);
      return {
        reply: `Error querying Zoho People: ${msg}. Please check your connection in Connected Services.`,
        source: "error",
      };
    }
  }

  if (detectedModule === "crm" || (detectedModule === "ambiguous" && enabledModules.includes("crm"))) {
    if (!enabledModules.includes("crm")) {
      return {
        reply: "You haven't enabled the Zoho CRM module. Go to Connected Services (Settings icon) and check the \"CRM\" checkbox to enable it.",
        source: "module_disabled",
      };
    }
    try {
      const result = await queryZohoCrm(query, clientId, clientSecret, refreshToken, accountsDomain);
      return { reply: formatCrmResult(result, query), source: "live" };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Zoho CRM API error:", msg);
      return {
        reply: `Error querying Zoho CRM: ${msg}. Please check your connection in Connected Services.`,
        source: "error",
      };
    }
  }

  if (enabledModules.length === 0) {
    return {
      reply: "Your Zoho account is connected but no modules are enabled. Go to Connected Services (Settings icon) and enable People and/or CRM.",
      source: "module_disabled",
    };
  }

  const available = enabledModules.map((m: string) => m === "people" ? "People (HR: employees, leave, attendance)" : "CRM (leads, contacts, deals, accounts)").join(" or ");
  return {
    reply: `I couldn't determine which Zoho module to use for your query. Try being more specific — you can ask about ${available}.`,
    source: "error",
  };
}
