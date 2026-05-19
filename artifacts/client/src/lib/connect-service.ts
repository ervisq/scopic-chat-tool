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
    hasInstanceUrl: false,
    oauth: true,
    fields: [],
  },
];

export function getProviderConfig(key: string): ProviderConfig | undefined {
  return PROVIDERS.find((p) => p.key === key);
}

function apiBase(): string {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

export const OAUTH_ORIGIN_STORAGE_KEY = "workhub:oauth_origin";

export type OAuthOriginPage = "dashboard" | "connections" | "chat" | "admin" | "account";

export async function startOAuthConnect(
  providerKey: string,
  token: string | null,
  origin?: OAuthOriginPage,
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
        if (origin && typeof window !== "undefined") {
          try {
            sessionStorage.setItem(OAUTH_ORIGIN_STORAGE_KEY, origin);
          } catch {
            // ignore storage errors
          }
        }
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

/**
 * Reads (and clears) the page the user was on when they started an OAuth
 * flow. Used by AuthGate to restore the user to that page after the
 * callback redirect, regardless of their default landing page.
 */
export function consumeOAuthOrigin(): OAuthOriginPage | null {
  if (typeof window === "undefined") return null;
  try {
    const value = sessionStorage.getItem(OAUTH_ORIGIN_STORAGE_KEY);
    if (value) sessionStorage.removeItem(OAUTH_ORIGIN_STORAGE_KEY);
    if (
      value === "dashboard" ||
      value === "connections" ||
      value === "chat" ||
      value === "admin" ||
      value === "account"
    ) {
      return value;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Returns true if the current URL contains any OAuth callback params
 * produced by the JIRA or Zoho OAuth flows. Does not modify the URL.
 */
export function hasOAuthCallbackParams(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return (
    params.has("jira_success") ||
    params.has("jira_error") ||
    params.has("zoho_success") ||
    params.has("zoho_error") ||
    params.has("teamwork_success") ||
    params.has("teamwork_error")
  );
}

/**
 * Snapshot of whether the page was loaded with OAuth callback params,
 * captured once at module load. Use this when multiple components need
 * to react to the OAuth return: one of them will eventually consume and
 * strip the params from the URL, after which `hasOAuthCallbackParams()`
 * would start returning false. This snapshot stays stable for the
 * lifetime of the page so callers do not depend on effect ordering.
 */
const INITIAL_HAD_OAUTH_CALLBACK_PARAMS = hasOAuthCallbackParams();
export function hadOAuthCallbackParamsAtLoad(): boolean {
  return INITIAL_HAD_OAUTH_CALLBACK_PARAMS;
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

export const TEAMWORK_OAUTH_ERROR_MESSAGES: Record<string, string> = {
  missing_params: "Teamwork authorization was incomplete. Please try again.",
  invalid_state: "Session expired. Please log in again and retry.",
  expired_state: "Session expired. Please log in again and retry.",
  no_access_token:
    "Teamwork did not return an access token. Please try again and make sure to accept all permissions.",
  no_refresh_token:
    "Teamwork did not return a refresh token. Please try again and make sure to accept all permissions.",
  no_site_url:
    "Teamwork did not return a site URL for your account. Please try again or contact support.",
  token_exchange_failed: "Failed to complete Teamwork authorization. Please try again.",
};

/**
 * Provider keys that support inline reconnect prompts when a tool reply
 * indicates the saved authorization is no longer valid.
 */
export type ReconnectProviderKey = "teamwork" | "jira" | "zoho";

/**
 * Detects whether a message from a tool indicates the connection has
 * expired or been revoked and needs to be reconnected via OAuth.
 * Returns the provider key to reconnect, or null.
 */
export function detectReconnectProvider(
  text: string,
  toolName?: string | null,
): ReconnectProviderKey | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  const needsReconnect =
    /reconnect/.test(lower) && /(expired|revoked|invalid)/.test(lower);
  if (!needsReconnect) return null;

  const tool = (toolName || "").toLowerCase();
  if (tool === "teamwork" || lower.includes("teamwork")) return "teamwork";
  if (tool === "jira" || lower.includes("jira")) return "jira";
  if (tool.startsWith("zoho") || lower.includes("zoho")) return "zoho";
  return null;
}

export const JIRA_OAUTH_SUCCESS_MESSAGE =
  "Jira connected successfully! Use @JIRA in chat to query tickets and issues.";
export const ZOHO_OAUTH_SUCCESS_MESSAGE =
  "Zoho connected successfully! Use @ZohoPeople, @ZohoCRM, @ZohoRecruit, and @ZohoContracts in chat.";
export const TEAMWORK_OAUTH_SUCCESS_MESSAGE =
  "Teamwork connected successfully! Use @Teamwork in chat to query tasks, projects, time, and more.";

export interface OAuthCallbackMessage {
  type: "success" | "error";
  text: string;
  provider: "jira" | "zoho" | "teamwork";
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

  const teamworkSuccess = params.get("teamwork_success");
  if (teamworkSuccess === "1" || teamworkSuccess === "true") {
    messages.push({ type: "success", text: TEAMWORK_OAUTH_SUCCESS_MESSAGE, provider: "teamwork" });
    touched = true;
  } else if (params.get("teamwork_error")) {
    const code = params.get("teamwork_error") || "";
    messages.push({
      type: "error",
      text: TEAMWORK_OAUTH_ERROR_MESSAGES[code] || `Teamwork connection failed: ${code}`,
      provider: "teamwork",
    });
    touched = true;
  }

  if (touched) {
    window.history.replaceState({}, "", window.location.pathname);
  }
  return messages;
}
