import { getUserCredentials } from "../lib/credential-store";

export interface StsServiceStatus {
  name: string;
  status: "Healthy" | "Degraded" | "Down";
  uptime: string;
  lastChecked: string;
}

export interface StsServiceResult {
  services: StsServiceStatus[];
  overallHealth: "Healthy" | "Degraded" | "Critical";
  source: "live" | "not_connected" | "error";
}

export async function querySts(query: string, userId?: number): Promise<StsServiceResult> {
  if (!userId) {
    return { services: [], overallHealth: "Healthy", source: "not_connected" };
  }

  const cred = await getUserCredentials(userId, "sts");
  if (!cred) {
    return { services: [], overallHealth: "Healthy", source: "not_connected" };
  }

  return { services: [], overallHealth: "Healthy", source: "not_connected" };
}

export function formatStsResult(result: StsServiceResult, query: string): string {
  if (result.source === "not_connected") {
    return "Your STS account is not connected. Please go to Connected Services (Settings icon) to link your STS credentials.";
  }
  if (result.source === "error") {
    return "There was an error connecting to STS. Please check your credentials in Connected Services and try again.";
  }
  const lines = result.services.map(
    (s) => `• ${s.name} — ${s.status} (Uptime: ${s.uptime})`,
  );
  return `STS Status Report (Overall: ${result.overallHealth}):\n${lines.join("\n")}\n\nQuery: "${query}"`;
}
