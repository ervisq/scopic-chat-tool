import { cn } from "@/lib/utils";
import { getToolConfig } from "@/lib/tool-config";

interface ToolBadgeProps {
  toolName: string;
  className?: string;
}

export function ToolBadge({ toolName, className }: ToolBadgeProps) {
  const config = getToolConfig(toolName);

  if (!config) {
    return (
      <span
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border bg-muted/50 text-muted-foreground border-border",
          className,
        )}
      >
        {toolName}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border",
        config.bgColor,
        config.textColor,
        config.borderColor,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
