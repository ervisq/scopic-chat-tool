import { getUserCredentials } from "../lib/credential-store";
import { queryZohoPeople, formatPeopleResult } from "./zohoPeopleService";
import { queryZohoCrm, formatCrmResult, type CrmSearchOptions } from "./zohoCrmService";
import { queryZohoRecruit, formatRecruitResult, type RecruitSearchOptions } from "./zohoRecruitService";
import { queryZohoContracts, formatContractsResult, ContractsSearchOptions } from "./zohoContractsService";
import { clearTokenCache, ZohoPermissionError } from "./zohoTokenManager";

export interface ZohoDirectResult {
  reply: string;
  source: "live" | "not_connected" | "error";
}

interface ZohoCredentials {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  accountsDomain: string;
}

const DEFAULT_ACCOUNTS_DOMAIN = "https://accounts.zoho.com";

async function getZohoCredentials(userId: number): Promise<ZohoCredentials | ZohoDirectResult> {
  const cred = await getUserCredentials(userId, "zoho");
  if (!cred) {
    return {
      reply: "Your Zoho account is not connected. Please go to Connected Services (Settings icon) and click 'Connect with Zoho'.",
      source: "not_connected",
    };
  }

  const { credentials } = cred;
  const { refreshToken, accountsDomain } = credentials;

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

  return {
    refreshToken,
    clientId,
    clientSecret,
    accountsDomain: accountsDomain || DEFAULT_ACCOUNTS_DOMAIN,
  };
}

function isError(result: unknown): result is ZohoDirectResult {
  return typeof result === "object" && result !== null && "reply" in result && "source" in result;
}

function isPermissionError(err: unknown): boolean {
  return err instanceof ZohoPermissionError;
}

async function handlePermissionError(
  serviceName: string,
  clientId: string,
  refreshToken: string,
): Promise<ZohoDirectResult> {
  await clearTokenCache(clientId, refreshToken);
  return {
    reply: `Zoho ${serviceName} access denied — your Zoho connection needs updated permissions. Please go to Connected Services, click 'Update' on the Zoho card, then click 'Reconnect' to grant ${serviceName} access.`,
    source: "error",
  };
}

export async function queryZohoPeopleDirect(query: string, userId?: number): Promise<ZohoDirectResult> {
  if (!userId) {
    return {
      reply: "Your Zoho account is not connected. Please go to Connected Services (Settings icon) and click 'Connect with Zoho'.",
      source: "not_connected",
    };
  }

  const credsOrError = await getZohoCredentials(userId);
  if (isError(credsOrError)) return credsOrError;

  const { refreshToken, clientId, clientSecret, accountsDomain } = credsOrError;

  try {
    const result = await queryZohoPeople(query, clientId, clientSecret, refreshToken, accountsDomain);
    return { reply: formatPeopleResult(result, query), source: "live" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Zoho People API error:", msg);

    if (isPermissionError(err)) {
      return handlePermissionError("People", clientId, refreshToken);
    }

    return {
      reply: `Error querying Zoho People: ${msg}. Please check your connection in Connected Services.`,
      source: "error",
    };
  }
}

export async function queryZohoCrmDirect(query: string, userId?: number, options?: CrmSearchOptions): Promise<ZohoDirectResult> {
  if (!userId) {
    return {
      reply: "Your Zoho account is not connected. Please go to Connected Services (Settings icon) and click 'Connect with Zoho'.",
      source: "not_connected",
    };
  }

  const credsOrError = await getZohoCredentials(userId);
  if (isError(credsOrError)) return credsOrError;

  const { refreshToken, clientId, clientSecret, accountsDomain } = credsOrError;

  try {
    const result = await queryZohoCrm(query, clientId, clientSecret, refreshToken, accountsDomain, options);
    return { reply: formatCrmResult(result, query), source: "live" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Zoho CRM API error:", msg);

    if (isPermissionError(err)) {
      return handlePermissionError("CRM", clientId, refreshToken);
    }

    return {
      reply: `Error querying Zoho CRM: ${msg}. Please check your connection in Connected Services.`,
      source: "error",
    };
  }
}

export async function queryZohoRecruitDirect(query: string, userId?: number, options?: RecruitSearchOptions): Promise<ZohoDirectResult> {
  if (!userId) {
    return {
      reply: "Your Zoho account is not connected. Please go to Connected Services (Settings icon) and click 'Connect with Zoho'.",
      source: "not_connected",
    };
  }

  const credsOrError = await getZohoCredentials(userId);
  if (isError(credsOrError)) return credsOrError;

  const { refreshToken, clientId, clientSecret, accountsDomain } = credsOrError;

  try {
    const result = await queryZohoRecruit(query, clientId, clientSecret, refreshToken, accountsDomain, options);
    return { reply: formatRecruitResult(result, query), source: "live" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Zoho Recruit API error:", msg);

    if (isPermissionError(err)) {
      return handlePermissionError("Recruit", clientId, refreshToken);
    }

    return {
      reply: `Error querying Zoho Recruit: ${msg}. Please check your connection in Connected Services.`,
      source: "error",
    };
  }
}

export async function queryZohoContractsDirect(query: string, userId?: number, options?: ContractsSearchOptions): Promise<ZohoDirectResult> {
  if (!userId) {
    return {
      reply: "Your Zoho account is not connected. Please go to Connected Services (Settings icon) and click 'Connect with Zoho'.",
      source: "not_connected",
    };
  }

  const credsOrError = await getZohoCredentials(userId);
  if (isError(credsOrError)) return credsOrError;

  const { refreshToken, clientId, clientSecret, accountsDomain } = credsOrError;

  try {
    const result = await queryZohoContracts(query, clientId, clientSecret, refreshToken, accountsDomain, options);
    return { reply: formatContractsResult(result, query), source: "live" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Zoho Contracts API error:", msg);

    if (isPermissionError(err)) {
      return handlePermissionError("Contracts", clientId, refreshToken);
    }

    return {
      reply: `Error querying Zoho Contracts: ${msg}. Please check your connection in Connected Services.`,
      source: "error",
    };
  }
}
