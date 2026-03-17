import { useState, useEffect } from "react";
import { ArrowLeft, Check, X, Loader2, ExternalLink } from "lucide-react";

interface ConnectionsPageProps {
  token: string | null;
  onBack: () => void;
}

interface Connection {
  provider: string;
  connected: boolean;
  instanceUrl?: string | null;
  connectedAt?: string;
}

interface ProviderConfig {
  name: string;
  key: string;
  color: string;
  description: string;
  fields: { key: string; label: string; type: string; placeholder: string }[];
  hasInstanceUrl: boolean;
}

const PROVIDERS: ProviderConfig[] = [
  {
    name: "JIRA",
    key: "jira",
    color: "bg-blue-500",
    description: "Connect your Atlassian Jira account to query tickets, track issues, and manage projects.",
    hasInstanceUrl: true,
    fields: [
      { key: "email", label: "Email", type: "email", placeholder: "you@company.com" },
      { key: "apiToken", label: "API Token", type: "password", placeholder: "Your Jira API token" },
    ],
  },
  {
    name: "Zoho",
    key: "zoho",
    color: "bg-amber-500",
    description: "Connect your Zoho Recruit account to manage candidates and recruitment pipelines.",
    hasInstanceUrl: false,
    fields: [
      { key: "clientId", label: "Client ID", type: "text", placeholder: "Zoho client ID" },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "Zoho client secret" },
      { key: "refreshToken", label: "Refresh Token", type: "password", placeholder: "Zoho refresh token" },
    ],
  },
  {
    name: "STS",
    key: "sts",
    color: "bg-emerald-500",
    description: "Connect to your STS monitoring service to track system health and uptime.",
    hasInstanceUrl: true,
    fields: [
      { key: "apiKey", label: "API Key", type: "password", placeholder: "Your STS API key" },
    ],
  },
];

export default function ConnectionsPage({ token, onBack }: ConnectionsPageProps) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, Record<string, string>>>({});
  const [instanceUrls, setInstanceUrls] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

  useEffect(() => {
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

  async function handleSave(provider: ProviderConfig) {
    const creds = formData[provider.key] || {};
    const allFilled = provider.fields.every((f) => creds[f.key]?.trim());
    if (!allFilled) {
      setMessage({ type: "error", text: "Please fill in all fields" });
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
        setInstanceUrls((prev) => ({ ...prev, [provider.key]: "" }));
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
      <header className="h-14 shrink-0 flex items-center gap-3 px-4 md:px-6 border-b border-border/50 bg-background">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="text-base font-semibold text-foreground">Connected Services</h1>
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
                            placeholder="https://your-instance.atlassian.net"
                            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all text-sm"
                          />
                        </div>
                      )}

                      {provider.fields.map((field) => (
                        <div key={field.key}>
                          <label className="block text-xs font-medium text-foreground mb-1">
                            {field.label}
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
