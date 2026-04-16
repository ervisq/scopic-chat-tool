import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, X } from "lucide-react";
import { TOOLS, type ToolConfig } from "@/lib/tool-config";
import { getPresetsForTool } from "@/lib/tool-presets";
import { cn } from "@/lib/utils";

interface ToolPillsProps {
  onPresetSelect: (query: string) => void;
  disabled?: boolean;
}

export function ToolPills({ onPresetSelect, disabled }: ToolPillsProps) {
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelected(null);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selected]);

  const selectedTool: ToolConfig | undefined = selected
    ? TOOLS.find((t) => t.name === selected)
    : undefined;
  const presets = selectedTool ? getPresetsForTool(selectedTool.name) : [];

  const handlePillClick = (name: string) => {
    setSelected((prev) => (prev === name ? null : name));
  };

  const handlePresetClick = (query: string) => {
    if (disabled) return;
    onPresetSelect(query);
    setSelected(null);
  };

  return (
    <div className="mb-2">
      <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1 -mx-1 px-1">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const isActive = selected === tool.name;
          return (
            <button
              key={tool.name}
              type="button"
              onClick={() => handlePillClick(tool.name)}
              aria-pressed={isActive}
              className={cn(
                "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                tool.bgColor,
                tool.textColor,
                isActive
                  ? "border-current ring-2 ring-current/20 shadow-sm"
                  : `${tool.borderColor} hover:border-current/60`,
              )}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              <span>{tool.label}</span>
              <ChevronDown
                className={cn(
                  "w-3 h-3 transition-transform opacity-70",
                  isActive && "rotate-180",
                )}
              />
            </button>
          );
        })}
      </div>

      <AnimatePresence initial={false}>
        {selectedTool && (
          <motion.div
            key={selectedTool.name}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                "mt-2 rounded-xl border bg-card p-3",
                selectedTool.borderColor,
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {selectedTool.icon && (
                    <selectedTool.icon className="w-4 h-4" />
                  )}
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      selectedTool.textColor,
                    )}
                  >
                    {selectedTool.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    · quick queries
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Close presets"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {presets.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">
                  No quick queries configured for this tool yet.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {presets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handlePresetClick(preset.query)}
                      disabled={disabled}
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-background hover:bg-accent border border-border/60 hover:border-border text-foreground/80 hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={preset.query}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
