import { useEffect, useState } from "react";
import { TOOLS } from "@/lib/tool-config";
import { useToolVisibility } from "@/lib/tool-visibility";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

interface ToolVisibilityPanelProps {
  className?: string;
  hiddenOverride?: Set<string>;
  onToggle?: (toolName: string, hidden: boolean) => void;
  showStatus?: boolean;
}

export function ToolVisibilityPanel({
  className,
  hiddenOverride,
  onToggle,
  showStatus = true,
}: ToolVisibilityPanelProps) {
  const { hiddenTools, setHidden, saving, justSaved, error, accessibleTools } = useToolVisibility();
  const effectiveHidden = hiddenOverride ?? hiddenTools;
  const handleToggle = onToggle ?? ((name: string, hidden: boolean) => setHidden(name, hidden));
  const visibleToolList = TOOLS.filter((t) => accessibleTools.has(t.name));

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1 mb-1">
        <span>Hidden tools stay accessible if you type them manually.</span>
        {showStatus && saving ? (
          <span className="inline-flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Saving…
          </span>
        ) : showStatus && justSaved ? (
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3" /> Saved
          </span>
        ) : null}
      </div>

      {showStatus && error && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 text-destructive text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-1.5">
        {visibleToolList.map((tool) => {
          const Icon = tool.icon;
          const hidden = effectiveHidden.has(tool.name);
          const visible = !hidden;
          const toggleId = `tool-visibility-${tool.name}`;
          return (
            <label
              key={tool.name}
              htmlFor={toggleId}
              className="flex items-center gap-3 p-2.5 rounded-lg border border-border/60 bg-card hover:bg-accent/30 transition-colors cursor-pointer"
            >
              <span
                className={cn(
                  "inline-flex w-8 h-8 rounded-lg items-center justify-center border shrink-0",
                  tool.bgColor,
                  tool.borderColor,
                )}
              >
                {Icon && <Icon className={cn("w-4 h-4", tool.textColor)} />}
              </span>
              <div className="flex-1 min-w-0">
                <div className={cn("text-sm font-medium", tool.textColor)}>
                  {tool.label}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {tool.description}
                </div>
              </div>
              <button
                id={toggleId}
                type="button"
                role="switch"
                aria-checked={visible}
                aria-label={`${visible ? "Hide" : "Show"} ${tool.label}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleToggle(tool.name, visible);
                }}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors",
                  visible ? "bg-primary" : "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5",
                    visible ? "translate-x-4" : "translate-x-0.5",
                  )}
                />
              </button>
            </label>
          );
        })}
      </div>
    </div>
  );
}

interface ToolVisibilityModalProps {
  open: boolean;
  onClose: () => void;
}

export function ToolVisibilityModal({ open, onClose }: ToolVisibilityModalProps) {
  const { hiddenTools, setHidden, saving, error, accessibleTools, refreshAccessibleTools } = useToolVisibility();
  const [draft, setDraft] = useState<Set<string>>(() => new Set(hiddenTools));

  useEffect(() => {
    if (open) {
      setDraft(new Set(hiddenTools));
      refreshAccessibleTools();
    }
    // Only re-sync when the modal transitions to open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const handleToggle = (name: string, hidden: boolean) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (hidden) next.add(name);
      else next.delete(name);
      return next;
    });
  };

  const handleDone = async () => {
    const changed: Array<[string, boolean]> = [];
    for (const tool of TOOLS) {
      if (!accessibleTools.has(tool.name)) continue;
      const wasHidden = hiddenTools.has(tool.name);
      const willBeHidden = draft.has(tool.name);
      if (wasHidden !== willBeHidden) {
        changed.push([tool.name, willBeHidden]);
      }
    }
    if (changed.length === 0) {
      onClose();
      return;
    }
    try {
      await Promise.all(changed.map(([name, hidden]) => setHidden(name, hidden)));
    } catch {
      // setHidden surfaces its own error toast / state; keep modal open so user sees it.
      return;
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Tool visibility"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
          <h2 className="text-base font-semibold text-foreground">Tool visibility</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-4 max-h-[70vh] overflow-y-auto">
          <ToolVisibilityPanel
            hiddenOverride={draft}
            onToggle={handleToggle}
            showStatus={false}
          />
          {error && (
            <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-destructive/10 text-destructive text-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-border/50 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted/50"
          >
            Cancel
          </button>
          <button
            onClick={handleDone}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
