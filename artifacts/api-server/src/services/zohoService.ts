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
  source: "live" | "mock" | "not_connected" | "error";
}

function getMockCandidates(): ZohoCandidate[] {
  return [
    { name: "Alice Johnson", role: "Frontend Developer", stage: "Interview Scheduled", email: "alice@example.com" },
    { name: "Bob Smith", role: "Backend Engineer", stage: "Under Review", email: "bob@example.com" },
    { name: "Carol Lee", role: "DevOps Specialist", stage: "Shortlisted", email: "carol@example.com" },
    { name: "Dave Wilson", role: "Full Stack Developer", stage: "Applied", email: "dave@example.com" },
  ];
}

export async function queryZoho(query: string, userId?: number): Promise<ZohoServiceResult> {
  if (!userId) {
    return { candidates: [], total: 0, source: "not_connected" };
  }

  const cred = await getUserCredentials(userId, "zoho");
  if (!cred) {
    return { candidates: [], total: 0, source: "not_connected" };
  }

  const candidates = getMockCandidates();
  return { candidates, total: candidates.length, source: "mock" };
}

export function formatZohoResult(result: ZohoServiceResult, query: string): string {
  if (result.source === "not_connected") {
    return "Your Zoho account is not connected. Please go to Connected Services (Settings icon) to link your Zoho credentials.";
  }
  if (result.source === "error") {
    return "There was an error connecting to Zoho. Please check your credentials in Connected Services and try again.";
  }
  const sourceLabel = result.source === "live" ? "Live Zoho" : "Zoho (mock)";
  const lines = result.candidates.map(
    (c) => `• ${c.name} — ${c.role} (${c.stage})`,
  );
  return `${sourceLabel} candidates (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
}
