export interface ProviderField {
  key: string;
  label: string;
  type: string;
  placeholder: string;
}

export interface ProviderConfig {
  name: string;
  key: string;
  color: string;
  description: string;
  fields: ProviderField[];
  hasInstanceUrl: boolean;
  oauth?: boolean;
  defaultInstanceUrl?: string;
  instanceUrlPlaceholder?: string;
}

export const PROVIDERS: ProviderConfig[] = [
  {
    name: "JIRA",
    key: "jira",
    color: "bg-blue-500",
    description:
      "Connect your Atlassian Jira account to query tickets, track issues, and manage projects. Use @JIRA in chat after connecting.",
    hasInstanceUrl: false,
    oauth: true,
    fields: [],
  },
  {
    name: "Zoho",
    key: "zoho",
    color: "bg-amber-500",
    description:
      "Connect your Zoho account to access People (HR), CRM (Sales), Recruit (Hiring), and Contracts data. Use @ZohoPeople, @ZohoCRM, @ZohoRecruit, and @ZohoContracts commands in chat.",
    hasInstanceUrl: false,
    oauth: true,
    fields: [],
  },
  {
    name: "STS",
    key: "sts",
    color: "bg-emerald-500",
    description:
      "Connect to STS (Scopic Time System) to view your working hours. Find your token in the STS URL after logging in: the value after token[token_id]= in the address bar.",
    hasInstanceUrl: true,
    defaultInstanceUrl: "https://time.scopicsoftware.com",
    instanceUrlPlaceholder: "https://time.scopicsoftware.com",
    fields: [
      {
        key: "tokenId",
        label: "STS Token",
        type: "password",
        placeholder: "Paste your token_id from the STS URL",
      },
    ],
  },
  {
    name: "Teamwork",
    key: "teamwork",
    color: "bg-purple-500",
    description:
      "Connect your Teamwork account to query tasks, projects, task lists, milestones, time entries, teams, people, comments, tags, and activity. Use @Teamwork in chat after connecting.",
    hasInstanceUrl: true,
    instanceUrlPlaceholder: "https://yoursite.teamwork.com",
    fields: [
      {
        key: "apiToken",
        label: "API Token",
        type: "password",
        placeholder: "Your Teamwork API token",
      },
    ],
  },
];

export function getProviderConfig(key: string): ProviderConfig | undefined {
  return PROVIDERS.find((p) => p.key === key);
}

function apiBase(): string {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

export async function startOAuthConnect(
  providerKey: string,
  token: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!token) return { ok: false, message: "Not signed in" };
  const baseUrl = apiBase();
  const endpoint = `${baseUrl}/api/${providerKey}/auth-url`;
  try {
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.authUrl) {
        window.location.href = data.authUrl;
        return { ok: true };
      }
      return { ok: false, message: "Authorization URL missing" };
    }
    const err = await res.json().catch(() => ({}));
    return {
      ok: false,
      message: err?.message || `Failed to start ${providerKey} authorization`,
    };
  } catch {
    return { ok: false, message: "Network error" };
  }
}

export async function saveCredentialsConnect(
  providerKey: string,
  credentials: Record<string, string>,
  instanceUrl: string | undefined,
  token: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!token) return { ok: false, message: "Not signed in" };
  const baseUrl = apiBase();
  try {
    const res = await fetch(`${baseUrl}/api/credentials/${providerKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ credentials, instanceUrl }),
    });
    if (res.ok) return { ok: true };
    const err = await res.json().catch(() => ({}));
    return { ok: false, message: err?.message || "Failed to save" };
  } catch {
    return { ok: false, message: "Network error" };
  }
}

export const JIRA_OAUTH_ERROR_MESSAGES: Record<string, string> = {
  missing_params: "Jira authorization was incomplete. Please try again.",
  invalid_state: "Session expired. Please log in again and retry.",
  no_refresh_token:
    "Jira did not grant offline access. Please try again and make sure to accept all permissions.",
  no_jira_site:
    "No Jira sites found for your Atlassian account. Make sure you have access to at least one Jira project.",
  token_exchange_failed: "Failed to complete Jira authorization. Please try again.",
  access_denied:
    "Jira authorization was denied. Please try again and accept the required permissions.",
};

export const ZOHO_OAUTH_ERROR_MESSAGES: Record<string, string> = {
  missing_params: "Zoho authorization was incomplete. Please try again.",
  invalid_state: "Session expired. Please log in again and retry.",
  no_refresh_token:
    "Zoho did not grant offline access. Please try again and make sure to accept all permissions.",
  token_exchange_failed: "Failed to complete Zoho authorization. Please try again.",
};

export const JIRA_OAUTH_SUCCESS_MESSAGE =
  "Jira connected successfully! Use @JIRA in chat to query tickets and issues.";
export const ZOHO_OAUTH_SUCCESS_MESSAGE =
  "Zoho connected successfully! Use @ZohoPeople, @ZohoCRM, @ZohoRecruit, and @ZohoContracts in chat.";

export interface OAuthCallbackMessage {
  type: "success" | "error";
  text: string;
  provider: "jira" | "zoho";
}

/**
 * Reads ?jira_success / ?zoho_success / ?jira_error / ?zoho_error from the
 * current URL, returns the message it represents (if any), and strips the
 * query params from the URL. Safe to call from any page that mounts after
 * the OAuth callback redirect.
 */
export function consumeOAuthCallbackMessages(): OAuthCallbackMessage[] {
  if (typeof window === "undefined") return [];
  const params = new URLSearchParams(window.location.search);
  const messages: OAuthCallbackMessage[] = [];
  let touched = false;

  if (params.get("jira_success") === "true") {
    messages.push({ type: "success", text: JIRA_OAUTH_SUCCESS_MESSAGE, provider: "jira" });
    touched = true;
  } else if (params.get("jira_error")) {
    const code = params.get("jira_error") || "";
    messages.push({
      type: "error",
      text: JIRA_OAUTH_ERROR_MESSAGES[code] || `Jira connection failed: ${code}`,
      provider: "jira",
    });
    touched = true;
  }

  if (params.get("zoho_success") === "true") {
    messages.push({ type: "success", text: ZOHO_OAUTH_SUCCESS_MESSAGE, provider: "zoho" });
    touched = true;
  } else if (params.get("zoho_error")) {
    const code = params.get("zoho_error") || "";
    messages.push({
      type: "error",
      text: ZOHO_OAUTH_ERROR_MESSAGES[code] || `Zoho connection failed: ${code}`,
      provider: "zoho",
    });
    touched = true;
  }

  if (touched) {
    window.history.replaceState({}, "", window.location.pathname);
  }
  return messages;
}
