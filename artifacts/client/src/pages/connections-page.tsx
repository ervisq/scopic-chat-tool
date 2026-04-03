import { useState, useEffect } from "react";
import { Check, X, Loader2, ExternalLink, Settings } from "lucide-react";

interface ConnectionsPageProps {
  token: string | null;
}

interface Connection {
  provider: string;
  connected: boolean;
  instanceUrl?: string | null;
  connectedAt?: string;
}

interface ProviderField {
  key: string;
  label: string;
  type: string;
  placeholder: string;
}

interface ProviderConfig {
  name: string;
  key: string;
  color: string;
  description: string;
  fields: ProviderField[];
  hasInstanceUrl: boolean;
  oauth?: boolean;
}

const PROVIDERS: ProviderConfig[] = [
  {
    name: "JIRA",
    key: "jira",
    color: "bg-blue-500",
    description: "Connect your Atlassian Jira account to query tickets, track issues, and manage projects. Use @JIRA in chat after connecting.",
    hasInstanceUrl: false,
    oauth: true,
    fields: [],
  },
  {
    name: "Zoho",
    key: "zoho",
    color: "bg-amber-500",
    description: "Connect your Zoho account to access People (HR), CRM (Sales), Recruit (Hiring), and Contracts data. Use @ZohoPeople, @ZohoCRM, @ZohoRecruit, and @ZohoContracts commands in chat.",
    hasInstanceUrl: false,
    oauth: true,
    fields: [],
  },
  {
    name: "STS",
    key: "sts",
    color: "bg-emerald-500",
    description: "Connect to STS (Scopic Time System) to view your working hours. Find your token in the STS URL after logging in: the value after token[token_id]= in the address bar.",
    hasInstanceUrl: true,
    fields: [
      { key: "tokenId", label: "STS Token", type: "password", placeholder: "Paste your token_id from the STS URL" },
    ],
  },
  {
    name: "Teamwork",
    key: "teamwork",
    color: "bg-purple-500",
    description: "Connect your Teamwork account to query tasks, projects, task lists, milestones, time entries, teams, people, comments, tags, and activity. Use @Teamwork in chat after connecting.",
    hasInstanceUrl: true,
    fields: [
      { key: "apiToken", label: "API Token", type: "password", placeholder: "Your Teamwork API token" },
    ],
  },
];

export default function ConnectionsPage({ token }: ConnectionsPageProps) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, Record<string, string>>>({});
  const [instanceUrls, setInstanceUrls] = useState<Record<string, string>>({
    sts: "https://time.scopicsoftware.com",
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("jira_success") === "true") {
      setMessage({ type: "success", text: "Jira connected successfully! Use @JIRA in chat to query tickets and issues." });
      setExpandedProvider("jira");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("jira_error")) {
      const errorMap: Record<string, string> = {
        missing_params: "Jira authorization was incomplete. Please try again.",
        invalid_state: "Session expired. Please log in again and retry.",
        no_refresh_token: "Jira did not grant offline access. Please try again and make sure to accept all permissions.",
        no_jira_site: "No Jira sites found for your Atlassian account. Make sure you have access to at least one Jira project.",
        token_exchange_failed: "Failed to complete Jira authorization. Please try again.",
        access_denied: "Jira authorization was denied. Please try again and accept the required permissions.",
      };
      const errCode = params.get("jira_error") || "";
      setMessage({ type: "error", text: errorMap[errCode] || `Jira connection failed: ${errCode}` });
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (params.get("zoho_success") === "true") {
      setMessage({ type: "success", text: "Zoho connected successfully! Use @ZohoPeople, @ZohoCRM, @ZohoRecruit, and @ZohoContracts in chat." });
      setExpandedProvider("zoho");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("zoho_error")) {
      const errorMap: Record<string, string> = {
        missing_params: "Zoho authorization was incomplete. Please try again.",
        invalid_state: "Session expired. Please log in again and retry.",
        no_refresh_token: "Zoho did not grant offline access. Please try again and make sure to accept all permissions.",
        token_exchange_failed: "Failed to complete Zoho authorization. Please try again.",
      };
      const errCode = params.get("zoho_error") || "";
      setMessage({ type: "error", text: errorMap[errCode] || `Zoho connection failed: ${errCode}` });
      window.history.replaceState({}, "", window.location.pathname);
    }


    fetchConnections();
  }, []);

  async function fetchConnections() {
    try {
      const res = await fetch(`${baseUrl}/api/credentials`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }

  function isConnected(provider: string): boolean {
    return connections.some((c) => c.provider === provider && c.connected);
  }

  function getConnection(provider: string): Connection | undefined {
    return connections.find((c) => c.provider === provider);
  }

  async function handleOAuthConnect(provider: ProviderConfig) {
    setOauthLoading(provider.key);
    setMessage(null);

    const oauthEndpoints: Record<string, string> = {
      jira: `${baseUrl}/api/jira/auth-url`,
      zoho: `${baseUrl}/api/zoho/auth-url`,
    };
    const authUrlEndpoint = oauthEndpoints[provider.key] || `${baseUrl}/api/${provider.key}/auth-url`;

    try {
      const res = await fetch(authUrlEndpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.authUrl;
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.message || `Failed to start ${provider.name} authorization` });
        setOauthLoading(null);
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
      setOauthLoading(null);
    }
  }

  async function handleSave(provider: ProviderConfig) {
    const creds = formData[provider.key] || {};
    const requiredFields = provider.fields.filter((f) => f.key !== "domain");
    const allFilled = requiredFields.every((f) => creds[f.key]?.trim());
    if (!allFilled) {
      setMessage({ type: "error", text: "Please fill in all required fields" });
      return;
    }
    if (provider.hasInstanceUrl && !instanceUrls[provider.key]?.trim()) {
      setMessage({ type: "error", text: "Instance URL is required" });
      return;
    }

    setSaving(provider.key);
    setMessage(null);
    try {
      const res = await fetch(`${baseUrl}/api/credentials/${provider.key}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          credentials: creds,
          instanceUrl: provider.hasInstanceUrl ? instanceUrls[provider.key] : undefined,
        }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: `${provider.name} connected successfully` });
        setExpandedProvider(null);
        setFormData((prev) => ({ ...prev, [provider.key]: {} }));
        setInstanceUrls((prev) => ({
          ...prev,
          [provider.key]: provider.key === "sts" ? "https://time.scopicsoftware.com" : "",
        }));
        await fetchConnections();
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.message || "Failed to save" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(null);
    }
  }

  async function handleDisconnect(providerKey: string, providerName: string) {
    setSaving(providerKey);
    try {
      const res = await fetch(`${baseUrl}/api/credentials/${providerKey}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setMessage({ type: "success", text: `${providerName} disconnected` });
        await fetchConnections();
      }
    } catch {
      setMessage({ type: "error", text: "Failed to disconnect" });
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex flex-col h-dvh bg-background">
      <header className="h-14 shrink-0 flex items-center px-4 md:px-6 border-b border-border/50 bg-background">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          <h1 className="text-base font-semibold text-foreground">Connected Services</h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <p className="text-sm text-muted-foreground mb-6">
            Connect your accounts to use tool commands in chat. Each employee connects their own credentials.
          </p>

          {message && (
            <div
              className={`p-3 rounded-lg text-sm ${
                message.type === "success"
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {message.text}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            PROVIDERS.map((provider) => {
              const connected = isConnected(provider.key);
              const conn = getConnection(provider.key);
              const expanded = expandedProvider === provider.key;

              return (
                <div
                  key={provider.key}
                  className="border border-border/60 rounded-xl bg-card overflow-hidden"
                >
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl ${provider.color} flex items-center justify-center`}>
                        <span className="text-white text-xs font-bold">
                          {provider.name.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">{provider.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {connected ? (
                            <span className="flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-500" />
                              Connected
                              {conn?.instanceUrl && (
                                <span className="ml-1 text-muted-foreground/70">
                                  ({conn.instanceUrl})
                                </span>
                              )}
                            </span>
                          ) : (
                            "Not connected"
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {connected && (
                        <button
                          onClick={() => handleDisconnect(provider.key, provider.name)}
                          disabled={saving === provider.key}
                          className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors disabled:opacity-50"
                        >
                          Disconnect
                        </button>
                      )}
                      <button
                        onClick={() =>
                          setExpandedProvider(expanded ? null : provider.key)
                        }
                        className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        {connected ? "Update" : "Connect"}
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t border-border/50 p-4 space-y-3 bg-background/50">
                      <p className="text-xs text-muted-foreground">{provider.description}</p>

                      {provider.oauth ? (
                        <>
                          {!connected && (
                            <button
                              onClick={() => handleOAuthConnect(provider)}
                              disabled={oauthLoading === provider.key}
                              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-white disabled:opacity-50 transition-colors text-sm font-medium ${provider.key === "jira" ? "bg-blue-500 hover:bg-blue-600" : "bg-amber-500 hover:bg-amber-600"}`}
                            >
                              {oauthLoading === provider.key ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <ExternalLink className="w-4 h-4" />
                              )}
                              Connect with {provider.name}
                            </button>
                          )}

                          {connected && provider.key === "jira" && (
                            <div className="space-y-2">
                              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                Connected! Use <span className="font-mono font-semibold">@JIRA</span> in chat to query tickets, track issues, and manage projects.
                              </p>
                              <button
                                onClick={() => handleOAuthConnect(provider)}
                                disabled={oauthLoading === provider.key}
                                className="text-xs px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors font-medium"
                              >
                                {oauthLoading === provider.key ? "..." : "Reconnect"}
                              </button>
                            </div>
                          )}

                          {connected && provider.key === "zoho" && (
                            <div className="space-y-2">
                              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                Connected! Use <span className="font-mono font-semibold">@ZohoPeople</span>, <span className="font-mono font-semibold">@ZohoCRM</span>, <span className="font-mono font-semibold">@ZohoRecruit</span>, and <span className="font-mono font-semibold">@ZohoContracts</span> in chat.
                              </p>
                              <div className="flex items-start gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                                <p className="text-xs text-amber-700 dark:text-amber-300">
                                  If Recruit or Contracts commands return errors, reconnect Zoho to grant updated permissions.
                                </p>
                                <button
                                  onClick={() => handleOAuthConnect(provider)}
                                  disabled={oauthLoading === provider.key}
                                  className="shrink-0 text-xs px-2 py-1 rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors font-medium"
                                >
                                  {oauthLoading === provider.key ? "..." : "Reconnect"}
                                </button>
                              </div>
                            </div>
                          )}

                        </>
                      ) : (
                        <>
                          {provider.hasInstanceUrl && (
                            <div>
                              <label className="block text-xs font-medium text-foreground mb-1">
                                Instance URL
                              </label>
                              <input
                                type="url"
                                value={instanceUrls[provider.key] || ""}
                                onChange={(e) =>
                                  setInstanceUrls((prev) => ({
                                    ...prev,
                                    [provider.key]: e.target.value,
                                  }))
                                }
                                placeholder={provider.key === "teamwork" ? "https://yoursite.teamwork.com" : provider.key === "sts" ? "https://time.scopicsoftware.com" : "https://your-instance.atlassian.net"}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all text-sm"
                              />
                            </div>
                          )}

                          {provider.fields.map((field) => (
                            <div key={field.key}>
                              <label className="block text-xs font-medium text-foreground mb-1">
                                {field.label}
                                {field.key === "domain" && (
                                  <span className="ml-1 text-muted-foreground font-normal">(optional)</span>
                                )}
                              </label>
                              <input
                                type={field.type}
                                value={formData[provider.key]?.[field.key] || ""}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    [provider.key]: {
                                      ...prev[provider.key],
                                      [field.key]: e.target.value,
                                    },
                                  }))
                                }
                                placeholder={field.placeholder}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all text-sm"
                              />
                            </div>
                          ))}

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              onClick={() => setExpandedProvider(null)}
                              className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSave(provider)}
                              disabled={saving === provider.key}
                              className="text-xs px-4 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                            >
                              {saving === provider.key && (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              )}
                              Save
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
