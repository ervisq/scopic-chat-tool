import { TOOLS } from "@/lib/tool-config";
import { useToolVisibility } from "@/lib/tool-visibility";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

interface ToolVisibilityPanelProps {
  className?: string;
}

export function ToolVisibilityPanel({ className }: ToolVisibilityPanelProps) {
  const { hiddenTools, setHidden, saving, justSaved, error } = useToolVisibility();

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1 mb-1">
        <span>Hidden tools stay accessible if you type them manually.</span>
        {saving ? (
          <span className="inline-flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Saving…
          </span>
        ) : justSaved ? (
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3" /> Saved
          </span>
        ) : null}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 text-destructive text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-1.5">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const hidden = hiddenTools.has(tool.name);
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
                  setHidden(tool.name, visible);
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
  if (!open) return null;
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
          <ToolVisibilityPanel />
        </div>
        <div className="px-5 py-3 border-t border-border/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
