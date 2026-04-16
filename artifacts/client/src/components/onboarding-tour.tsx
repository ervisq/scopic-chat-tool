import { useState, useEffect, useCallback, useRef } from "react";
import { X } from "lucide-react";

export interface TourStep {
  target: string;
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
  navigateTo?: string;
}

interface OnboardingTourProps {
  steps: TourStep[];
  onComplete: () => void;
  onNavigate?: (page: string) => void;
  userEmail?: string;
}

const STORAGE_PREFIX = "workhub_tour_completed";

function getStorageKey(userEmail?: string): string {
  return userEmail ? `${STORAGE_PREFIX}:${userEmail}` : STORAGE_PREFIX;
}

export function isTourCompleted(userEmail?: string): boolean {
  return localStorage.getItem(getStorageKey(userEmail)) === "true";
}

export function markTourCompleted(userEmail?: string) {
  localStorage.setItem(getStorageKey(userEmail), "true");
}

export function resetTourCompleted(userEmail?: string) {
  localStorage.removeItem(getStorageKey(userEmail));
}

export default function OnboardingTour({ steps, onComplete, onNavigate, userEmail }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({});
  const [arrowClass, setArrowClass] = useState("");
  const [visible, setVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = steps[currentStep];

  const positionTooltip = useCallback(() => {
    if (!step) return;

    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) {
      setTooltipStyle({ top: "50%", left: "50%", transform: "translate(-50%, -50%)" });
      setArrowStyle({});
      setArrowClass("");
      setVisible(true);
      return;
    }

    const rect = el.getBoundingClientRect();
    const gap = 12;
    const tooltipEl = tooltipRef.current;
    const tw = tooltipEl?.offsetWidth || 300;
    const th = tooltipEl?.offsetHeight || 160;

    let pos = step.position || "bottom";
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (pos === "bottom" && rect.bottom + gap + th > vh) pos = "top";
    if (pos === "top" && rect.top - gap - th < 0) pos = "bottom";
    if (pos === "right" && rect.right + gap + tw > vw) pos = "left";
    if (pos === "left" && rect.left - gap - tw < 0) pos = "right";

    let style: React.CSSProperties = {};
    let aStyle: React.CSSProperties = {};
    let aClass = "";

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    if (pos === "bottom") {
      let left = centerX - tw / 2;
      left = Math.max(12, Math.min(left, vw - tw - 12));
      style = { top: rect.bottom + gap, left };
      aStyle = { left: Math.min(Math.max(centerX - left - 6, 12), tw - 24), top: -6 };
      aClass = "border-l-transparent border-r-transparent border-b-[6px] border-l-[6px] border-r-[6px] border-b-card";
    } else if (pos === "top") {
      let left = centerX - tw / 2;
      left = Math.max(12, Math.min(left, vw - tw - 12));
      style = { top: rect.top - gap - th, left };
      aStyle = { left: Math.min(Math.max(centerX - left - 6, 12), tw - 24), bottom: -6 };
      aClass = "border-l-transparent border-r-transparent border-t-[6px] border-l-[6px] border-r-[6px] border-t-card";
    } else if (pos === "right") {
      let top = centerY - th / 2;
      top = Math.max(12, Math.min(top, vh - th - 12));
      style = { top, left: rect.right + gap };
      aStyle = { top: Math.min(Math.max(centerY - top - 6, 12), th - 24), left: -6 };
      aClass = "border-t-transparent border-b-transparent border-r-[6px] border-t-[6px] border-b-[6px] border-r-card";
    } else {
      let top = centerY - th / 2;
      top = Math.max(12, Math.min(top, vh - th - 12));
      style = { top, left: rect.left - gap - tw };
      aStyle = { top: Math.min(Math.max(centerY - top - 6, 12), th - 24), right: -6 };
      aClass = "border-t-transparent border-b-transparent border-l-[6px] border-t-[6px] border-b-[6px] border-l-card";
    }

    setTooltipStyle(style);
    setArrowStyle(aStyle);
    setArrowClass(aClass);
    setVisible(true);
  }, [step]);

  useEffect(() => {
    if (!step) return;

    if (step.navigateTo && onNavigate) {
      onNavigate(step.navigateTo);
    }

    setVisible(false);
    const timer = setTimeout(() => {
      positionTooltip();
    }, 300);

    window.addEventListener("resize", positionTooltip);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", positionTooltip);
    };
  }, [currentStep, step, positionTooltip, onNavigate]);

  useEffect(() => {
    if (visible) {
      positionTooltip();
    }
  }, [visible, positionTooltip]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      markTourCompleted(userEmail);
      onComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    markTourCompleted(userEmail);
    onComplete();
  };

  if (!step) return null;

  const targetEl = document.querySelector(`[data-tour="${step.target}"]`);
  const targetRect = targetEl?.getBoundingClientRect();

  return (
    <div className="fixed inset-0 z-[9999]">
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - 4}
                y={targetRect.top - 4}
                width={targetRect.width + 8}
                height={targetRect.height + 8}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0" y="0" width="100%" height="100%"
          fill="rgba(0,0,0,0.5)"
          mask="url(#tour-mask)"
          style={{ pointerEvents: "auto" }}
          onClick={handleSkip}
        />
      </svg>

      {targetRect && (
        <div
          className="absolute rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-transparent pointer-events-none"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
          }}
        />
      )}

      <div
        ref={tooltipRef}
        className={`absolute w-[300px] bg-card border border-border/60 rounded-xl shadow-xl transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
        style={{ ...tooltipStyle, zIndex: 10000 }}
      >
        <div className="absolute" style={arrowStyle}>
          <div className={`w-0 h-0 ${arrowClass}`} />
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground pr-6">{step.title}</h3>
            <button
              onClick={handleSkip}
              className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mb-4">{step.description}</p>

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground/60">
              {currentStep + 1} of {steps.length}
            </span>
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  onClick={handleBack}
                  className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                >
                  Back
                </button>
              )}
              <button
                onClick={handleNext}
                className="text-xs px-4 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
              >
                {currentStep === steps.length - 1 ? "Done" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
