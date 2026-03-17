import { getUserCredentials } from "../lib/credential-store";

export interface ZohoCandidate {
  name: string;
  role: string;
  stage: "Applied" | "Shortlisted" | "Interview Scheduled" | "Under Review" | "Offered" | "Rejected";
  email: string;
}

export interface ZohoServiceResult {
  candidates: ZohoCandidate[];
  total: number;
  source: "live" | "not_connected" | "error";
}

export async function queryZoho(query: string, userId?: number): Promise<ZohoServiceResult> {
  if (!userId) {
    return { candidates: [], total: 0, source: "not_connected" };
  }

  const cred = await getUserCredentials(userId, "zoho");
  if (!cred) {
    return { candidates: [], total: 0, source: "not_connected" };
  }

  return { candidates: [], total: 0, source: "not_connected" };
}

export function formatZohoResult(result: ZohoServiceResult, query: string): string {
  if (result.source === "not_connected") {
    return "Your Zoho account is not connected. Please go to Connected Services (Settings icon) to link your Zoho credentials.";
  }
  if (result.source === "error") {
    return "There was an error connecting to Zoho. Please check your credentials in Connected Services and try again.";
  }
  const lines = result.candidates.map(
    (c) => `• ${c.name} — ${c.role} (${c.stage})`,
  );
  return `Zoho candidates (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
}
