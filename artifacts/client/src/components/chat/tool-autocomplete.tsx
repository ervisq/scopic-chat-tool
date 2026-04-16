import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToolVisibility } from "@/lib/tool-visibility";
import { cn } from "@/lib/utils";

interface ToolAutocompleteProps {
  inputValue: string;
  selectedIndex: number;
  onSelect: (toolName: string) => void;
  visible: boolean;
}

export function useToolAutocomplete(inputValue: string) {
  const { visibleTools } = useToolVisibility();
  const trimmed = inputValue.trim();

  if (!trimmed.startsWith("@")) {
    return { suggestions: [], visible: false };
  }

  const afterAt = trimmed.slice(1).toLowerCase();

  if (afterAt.includes(" ")) {
    return { suggestions: [], visible: false };
  }

  const suggestions = visibleTools.filter((t) =>
    t.name.toLowerCase().startsWith(afterAt),
  );

  return { suggestions, visible: suggestions.length > 0 };
}

export function ToolAutocomplete({
  inputValue,
  selectedIndex,
  onSelect,
  visible,
}: ToolAutocompleteProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const { suggestions } = useToolAutocomplete(inputValue);

  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const items = listRef.current.children;
      if (items[selectedIndex]) {
        (items[selectedIndex] as HTMLElement).scrollIntoView({
          block: "nearest",
        });
      }
    }
  }, [selectedIndex]);

  if (!visible || suggestions.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={listRef}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.15 }}
        className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-20"
        role="listbox"
      >
        {suggestions.map((tool, i) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.name}
              role="option"
              aria-selected={i === selectedIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(tool.name);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                i === selectedIndex
                  ? "bg-accent"
                  : "hover:bg-accent/50",
              )}
            >
              {Icon && <Icon className="w-5 h-5 shrink-0" />}
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border",
                  tool.bgColor,
                  tool.textColor,
                  tool.borderColor,
                )}
              >
                {tool.label}
              </span>
              <span className="text-sm text-muted-foreground">
                {tool.description}
              </span>
            </button>
          );
        })}
      </motion.div>
    </AnimatePresence>
  );
}
