import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type ProviderConfig,
  saveCredentialsConnect,
} from "@/lib/connect-service";

interface ConnectServiceDialogProps {
  provider: ProviderConfig | null;
  token: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: () => void;
  onSavingChange?: (saving: boolean) => void;
  mode?: "connect" | "update";
}

export function ConnectServiceDialog({
  provider,
  token,
  open,
  onOpenChange,
  onConnected,
  onSavingChange,
  mode = "connect",
}: ConnectServiceDialogProps) {
  const isUpdate = mode === "update";
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [instanceUrl, setInstanceUrl] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && provider) {
      setCreds({});
      setInstanceUrl(provider.defaultInstanceUrl || "");
      setError(null);
      setSaving(false);
    }
  }, [open, provider]);

  useEffect(() => {
    onSavingChange?.(saving);
  }, [saving, onSavingChange]);

  useEffect(() => {
    if (!open) {
      onSavingChange?.(false);
    }
  }, [open, onSavingChange]);

  if (!provider) return null;

  async function handleSave() {
    if (!provider) return;
    const requiredFields = provider.fields.filter((f) => f.key !== "domain");
    const allFilled = requiredFields.every((f) => creds[f.key]?.trim());
    if (!allFilled) {
      setError("Please fill in all required fields");
      return;
    }
    if (provider.hasInstanceUrl && !instanceUrl.trim()) {
      setError("Instance URL is required");
      return;
    }
    setError(null);
    setSaving(true);
    const result = await saveCredentialsConnect(
      provider.key,
      creds,
      provider.hasInstanceUrl ? instanceUrl : undefined,
      token,
    );
    setSaving(false);
    if (result.ok) {
      onOpenChange(false);
      onConnected();
    } else {
      setError(result.message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isUpdate ? `Update ${provider.name} connection` : `Connect ${provider.name}`}
          </DialogTitle>
          <DialogDescription>
            {isUpdate
              ? "Enter your new credentials below to replace the ones currently saved."
              : provider.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {provider.hasInstanceUrl && (
            <div>
              <label
                htmlFor={`connect-${provider.key}-instance-url`}
                className="block text-xs font-medium text-foreground mb-1"
              >
                Instance URL
              </label>
              <input
                id={`connect-${provider.key}-instance-url`}
                type="url"
                value={instanceUrl}
                onChange={(e) => setInstanceUrl(e.target.value)}
                placeholder={
                  provider.instanceUrlPlaceholder || "https://your-instance.example.com"
                }
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all text-sm"
              />
            </div>
          )}

          {provider.fields.map((field) => {
            const inputId = `connect-${provider.key}-${field.key}`;
            return (
              <div key={field.key}>
                <label
                  htmlFor={inputId}
                  className="block text-xs font-medium text-foreground mb-1"
                >
                  {field.label}
                  {field.key === "domain" && (
                    <span className="ml-1 text-muted-foreground font-normal">(optional)</span>
                  )}
                </label>
                <input
                  id={inputId}
                  type={field.type}
                  value={creds[field.key] || ""}
                  onChange={(e) =>
                    setCreds((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all text-sm"
                />
              </div>
            );
          })}

          {error && (
            <div className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="text-xs px-4 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              {isUpdate ? "Update" : "Save"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
