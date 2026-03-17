export interface ZohoCandidate {
  name: string;
  role: string;
  stage: "Applied" | "Shortlisted" | "Interview Scheduled" | "Under Review" | "Offered" | "Rejected";
  email: string;
}

export interface ZohoServiceResult {
  candidates: ZohoCandidate[];
  total: number;
}

export async function queryZoho(query: string): Promise<ZohoServiceResult> {
  const candidates: ZohoCandidate[] = [
    { name: "Alice Johnson", role: "Frontend Developer", stage: "Interview Scheduled", email: "alice@example.com" },
    { name: "Bob Smith", role: "Backend Engineer", stage: "Under Review", email: "bob@example.com" },
    { name: "Carol Lee", role: "DevOps Specialist", stage: "Shortlisted", email: "carol@example.com" },
    { name: "Dave Wilson", role: "Full Stack Developer", stage: "Applied", email: "dave@example.com" },
  ];

  return { candidates, total: candidates.length };
}

export function formatZohoResult(result: ZohoServiceResult, query: string): string {
  const lines = result.candidates.map(
    (c) => `• ${c.name} — ${c.role} (${c.stage})`,
  );
  return `Here are your Zoho candidates (${result.total} found):\n${lines.join("\n")}\n\nQuery: "${query}"`;
}
