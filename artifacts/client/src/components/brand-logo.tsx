import scopicLogo from "@assets/Logo_Scopic_MCP_Chat_1780044757107.svg";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  variant?: "full" | "mark";
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const MARK_SIZE_CLASSES: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  sm: "w-7 h-7",
  md: "w-8 h-8",
  lg: "w-10 h-10",
  xl: "w-16 h-16",
};

const WORDMARK_TEXT_CLASSES: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
  xl: "text-3xl",
};

const WORDMARK_GAP_CLASSES: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  sm: "gap-1.5",
  md: "gap-2",
  lg: "gap-2.5",
  xl: "gap-3",
};

function Mark({ size }: { size: NonNullable<BrandLogoProps["size"]> }) {
  return (
    <div className={cn("relative inline-block shrink-0", MARK_SIZE_CLASSES[size])}>
      <img
        src={scopicLogo}
        alt=""
        aria-hidden="true"
        className="h-full w-full object-contain"
        draggable={false}
      />
    </div>
  );
}

export function BrandLogo({ variant = "full", className, size = "md" }: BrandLogoProps) {
  if (variant === "mark") {
    return (
      <div role="img" aria-label="AI Chat" className={cn("inline-block", className)}>
        <Mark size={size} />
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label="AI Chat"
      className={cn("inline-flex items-center", WORDMARK_GAP_CLASSES[size], className)}
    >
      <Mark size={size} />
      <span
        className={cn(
          "font-bold tracking-tight text-foreground whitespace-nowrap",
          WORDMARK_TEXT_CLASSES[size],
        )}
      >
        AI Chat
      </span>
    </div>
  );
}

export default BrandLogo;
