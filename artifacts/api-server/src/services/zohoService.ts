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
  source: "live" | "mock";
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
  if (userId) {
    const cred = await getUserCredentials(userId, "zoho");
    if (cred) {
      console.log("Zoho credentials found for user — live API integration coming soon");
    }
  }

  const candidates = getMockCandidates();
  return { candidates, total: candidates.length, source: "mock" };
}

export function formatZohoResult(result: ZohoServiceResult, query: string): string {
  const sourceLabel = result.source === "live" ? "Live Zoho" : "Zoho";
  const lines = result.candidates.map(
    (c) => `• ${c.name} — ${c.role} (${c.stage})`,
  );
  return `${sourceLabel} candidates (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
}
