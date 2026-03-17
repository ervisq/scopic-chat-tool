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
  source: "live" | "mock" | "not_connected" | "error";
}

function getMockServices(): StsServiceStatus[] {
  return [
    { name: "Auth Gateway", status: "Healthy", uptime: "99.98%", lastChecked: new Date().toISOString() },
    { name: "Payment API", status: "Degraded", uptime: "97.5%", lastChecked: new Date().toISOString() },
    { name: "Notification Service", status: "Healthy", uptime: "99.99%", lastChecked: new Date().toISOString() },
    { name: "Search Index", status: "Healthy", uptime: "99.95%", lastChecked: new Date().toISOString() },
  ];
}

export async function querySts(query: string, userId?: number): Promise<StsServiceResult> {
  if (!userId) {
    return { services: [], overallHealth: "Healthy", source: "not_connected" };
  }

  const cred = await getUserCredentials(userId, "sts");
  if (!cred) {
    return { services: [], overallHealth: "Healthy", source: "not_connected" };
  }

  const services = getMockServices();
  const hasDegraded = services.some((s) => s.status === "Degraded");
  const hasDown = services.some((s) => s.status === "Down");
  const overallHealth = hasDown ? "Critical" : hasDegraded ? "Degraded" : "Healthy";

  return { services, overallHealth, source: "mock" };
}

export function formatStsResult(result: StsServiceResult, query: string): string {
  if (result.source === "not_connected") {
    return "Your STS account is not connected. Please go to Connected Services (Settings icon) to link your STS credentials.";
  }
  if (result.source === "error") {
    return "There was an error connecting to STS. Please check your credentials in Connected Services and try again.";
  }
  const sourceLabel = result.source === "live" ? "Live STS" : "STS (mock)";
  const lines = result.services.map(
    (s) => `• ${s.name} — ${s.status} (Uptime: ${s.uptime})`,
  );
  return `${sourceLabel} Status Report (Overall: ${result.overallHealth}):\n${lines.join("\n")}\n\nQuery: "${query}"`;
}
