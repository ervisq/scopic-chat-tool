import { MessageCircle } from "lucide-react";
import scopicLogo from "@assets/scopic_logo_1_1776970385236.png";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  variant?: "full" | "mark";
  className?: string;
  size?: "sm" | "md" | "lg";
}

const FULL_SIZE_CLASSES: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  sm: "h-6",
  md: "h-7",
  lg: "h-9",
};

const MARK_SIZE_CLASSES: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  sm: "w-7 h-7",
  md: "w-8 h-8",
  lg: "w-10 h-10",
};

const BADGE_SIZE_CLASSES: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  sm: "w-3 h-3",
  md: "w-3.5 h-3.5",
  lg: "w-4 h-4",
};

const BADGE_ICON_CLASSES: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  sm: "w-2 h-2",
  md: "w-2.5 h-2.5",
  lg: "w-2.5 h-2.5",
};

export function BrandLogo({ variant = "full", className, size = "md" }: BrandLogoProps) {
  if (variant === "mark") {
    return (
      <div
        role="img"
        aria-label="AI Chat"
        className={cn("relative inline-block shrink-0", MARK_SIZE_CLASSES[size], className)}
      >
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={scopicLogo}
            alt=""
            aria-hidden="true"
            className="absolute left-0 top-0 h-full w-auto max-w-none"
          />
        </div>
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-card",
            BADGE_SIZE_CLASSES[size],
          )}
        >
          <MessageCircle className={cn("fill-current", BADGE_ICON_CLASSES[size])} strokeWidth={0} />
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn("relative inline-flex items-center shrink-0", className)}
      aria-label="AI Chat"
    >
      <img
        src={scopicLogo}
        alt="AI Chat"
        className={cn("w-auto select-none", FULL_SIZE_CLASSES[size])}
        draggable={false}
      />
      <span
        className={cn(
          "absolute inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background",
          BADGE_SIZE_CLASSES[size],
        )}
        style={{
          left: size === "lg" ? "1.65rem" : size === "md" ? "1.3rem" : "1.1rem",
          bottom: "-0.15rem",
        }}
      >
        <MessageCircle className={cn("fill-current", BADGE_ICON_CLASSES[size])} strokeWidth={0} />
      </span>
    </div>
  );
}

export default BrandLogo;
