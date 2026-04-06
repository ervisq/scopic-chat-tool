import { getUserCredentials } from "../lib/credential-store";
import { queryZohoPeople, formatPeopleResult } from "./zohoPeopleService";
import { queryZohoCrm, formatCrmResult } from "./zohoCrmService";
import { queryZohoRecruit, formatRecruitResult } from "./zohoRecruitService";
import { queryZohoContracts, formatContractsResult } from "./zohoContractsService";
import { clearTokenCache } from "./zohoTokenManager";

export interface ZohoDirectResult {
  reply: string;
  source: "live" | "not_connected" | "error";
}

async function getZohoCredentials(userId: number): Promise<{ refreshToken: string; clientId: string; clientSecret: string } | ZohoDirectResult> {
  const cred = await getUserCredentials(userId, "zoho");
  if (!cred) {
    return {
      reply: "Your Zoho account is not connected. Please go to Connected Services (Settings icon) and click 'Connect with Zoho'.",
      source: "not_connected",
    };
  }

  const { credentials } = cred;
  const { refreshToken } = credentials;

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

  return { refreshToken, clientId, clientSecret };
}

function isError(result: unknown): result is ZohoDirectResult {
  return typeof result === "object" && result !== null && "reply" in result && "source" in result;
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

  const { refreshToken, clientId, clientSecret } = credsOrError;

  try {
    const result = await queryZohoPeople(query, clientId, clientSecret, refreshToken, "https://accounts.zoho.com");
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

export async function queryZohoCrmDirect(query: string, userId?: number): Promise<ZohoDirectResult> {
  if (!userId) {
    return {
      reply: "Your Zoho account is not connected. Please go to Connected Services (Settings icon) and click 'Connect with Zoho'.",
      source: "not_connected",
    };
  }

  const credsOrError = await getZohoCredentials(userId);
  if (isError(credsOrError)) return credsOrError;

  const { refreshToken, clientId, clientSecret } = credsOrError;

  try {
    const result = await queryZohoCrm(query, clientId, clientSecret, refreshToken, "https://accounts.zoho.com");
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

export async function queryZohoRecruitDirect(query: string, userId?: number): Promise<ZohoDirectResult> {
  if (!userId) {
    return {
      reply: "Your Zoho account is not connected. Please go to Connected Services (Settings icon) and click 'Connect with Zoho'.",
      source: "not_connected",
    };
  }

  const credsOrError = await getZohoCredentials(userId);
  if (isError(credsOrError)) return credsOrError;

  const { refreshToken, clientId, clientSecret } = credsOrError;

  try {
    const result = await queryZohoRecruit(query, clientId, clientSecret, refreshToken, "https://accounts.zoho.com");
    return { reply: formatRecruitResult(result, query), source: "live" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Zoho Recruit API error:", msg);

    if (msg.includes("access denied") || msg.includes("401") || msg.includes("403") || msg.includes("400")) {
      await clearTokenCache(clientId, refreshToken);
      return {
        reply: "Zoho Recruit access denied — your Zoho connection needs updated permissions. Please go to Connected Services, click 'Update' on the Zoho card, then click 'Reconnect' to grant Recruit access.",
        source: "error",
      };
    }

    return {
      reply: `Error querying Zoho Recruit: ${msg}. Please check your connection in Connected Services.`,
      source: "error",
    };
  }
}

export async function queryZohoContractsDirect(query: string, userId?: number): Promise<ZohoDirectResult> {
  if (!userId) {
    return {
      reply: "Your Zoho account is not connected. Please go to Connected Services (Settings icon) and click 'Connect with Zoho'.",
      source: "not_connected",
    };
  }

  const credsOrError = await getZohoCredentials(userId);
  if (isError(credsOrError)) return credsOrError;

  const { refreshToken, clientId, clientSecret } = credsOrError;

  try {
    const result = await queryZohoContracts(query, clientId, clientSecret, refreshToken, "https://accounts.zoho.com");
    return { reply: formatContractsResult(result, query), source: "live" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Zoho Contracts API error:", msg);

    if (msg.includes("access denied") || msg.includes("401") || msg.includes("403") || msg.includes("400")) {
      await clearTokenCache(clientId, refreshToken);
      return {
        reply: "Zoho Contracts access denied — your Zoho connection needs updated permissions. Please go to Connected Services, click 'Update' on the Zoho card, then click 'Reconnect' to grant Contracts access.",
        source: "error",
      };
    }

    return {
      reply: `Error querying Zoho Contracts: ${msg}. Please check your connection in Connected Services.`,
      source: "error",
    };
  }
}
