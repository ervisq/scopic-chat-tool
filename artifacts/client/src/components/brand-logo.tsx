import { MessageCircle } from "lucide-react";
import scopicLogo from "@assets/scopic_logo_1_1776970385236.png";
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

const BADGE_SIZE_CLASSES: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  sm: "w-3 h-3",
  md: "w-3.5 h-3.5",
  lg: "w-4 h-4",
  xl: "w-5 h-5",
};

const BADGE_ICON_CLASSES: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  sm: "w-2 h-2",
  md: "w-2.5 h-2.5",
  lg: "w-2.5 h-2.5",
  xl: "w-3 h-3",
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

function Mark({ size, ringClass }: { size: NonNullable<BrandLogoProps["size"]>; ringClass: string }) {
  return (
    <div className={cn("relative inline-block shrink-0", MARK_SIZE_CLASSES[size])}>
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={scopicLogo}
          alt=""
          aria-hidden="true"
          className="absolute left-0 top-0 h-full w-auto max-w-none"
          draggable={false}
        />
      </div>
      <span
        className={cn(
          "absolute -bottom-0.5 -right-0.5 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground ring-2",
          ringClass,
          BADGE_SIZE_CLASSES[size],
        )}
      >
        <MessageCircle className={cn("fill-current", BADGE_ICON_CLASSES[size])} strokeWidth={0} />
      </span>
    </div>
  );
}

export function BrandLogo({ variant = "full", className, size = "md" }: BrandLogoProps) {
  if (variant === "mark") {
    return (
      <div role="img" aria-label="AI Chat" className={cn("inline-block", className)}>
        <Mark size={size} ringClass="ring-card" />
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label="AI Chat"
      className={cn("inline-flex items-center", WORDMARK_GAP_CLASSES[size], className)}
    >
      <Mark size={size} ringClass="ring-background" />
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
