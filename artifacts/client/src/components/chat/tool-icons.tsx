import type { ComponentProps } from "react";

type IconProps = ComponentProps<"svg">;

export function JiraIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M11.53 2c0 4.97 3.97 9 8.47 9H22v.47C22 16.72 17.78 21 12.53 21 7.28 21 3 16.72 3 11.47V11.2c0-.1.08-.2.19-.2h3.32c4.5 0 8.47-4.03 8.47-9H11.53Z"
        fill="#2684FF"
      />
      <path
        d="M11.53 2c0 4.97-4 9-8.5 9H.5a.5.5 0 0 0-.5.5C0 16.75 4.25 21 9.5 21h.03C14.78 21 19 16.72 19 11.47V11h-1c-4.5 0-8.47-4.03-8.47-9h2Z"
        fill="url(#jira-grad)"
      />
      <defs>
        <linearGradient id="jira-grad" x1="9" y1="21" x2="0" y2="11" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0052CC" />
          <stop offset="1" stopColor="#2684FF" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function TeamworkIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="11" fill="#6B46C1" />
      <path
        d="M8 8.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm5 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM7 12.5c0-.28.22-.5.5-.5h2a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-4Zm7 0c0-.28.22-.5.5-.5h2a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-4Z"
        fill="#fff"
      />
    </svg>
  );
}

export function OutlookIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M13 2v8h9l-1-4-4-3-4-1Z" fill="#1490DF" />
      <path d="M22 10h-9v8l9-1V10Z" fill="#28A8EA" />
      <path d="M13 18v4l9-2v-4l-9 2Z" fill="#0078D4" />
      <path d="M22 10V6l-9 4v8l9-2V10Z" fill="#0364B8" opacity="0.5" />
      <rect x="1" y="5" width="12" height="14" rx="1.5" fill="#0078D4" />
      <ellipse cx="7" cy="12" rx="3.5" ry="4" fill="none" stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}

export function ZohoIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M2 7.5 7.5 2h3L5 7.5 10.5 13h-3L2 7.5Z"
        fill="#E8443A"
      />
      <path
        d="M7 12c0-2.76 2.24-5 5-5s5 2.24 5 5-2.24 5-5 5-5-2.24-5-5Z"
        fill="#F0C021"
      />
      <path
        d="M7 12c0-2.76 2.24-5 5-5s5 2.24 5 5"
        fill="none"
        stroke="#E8443A"
        strokeWidth="0"
      />
      <path
        d="M15 11h6.5l-3 5.5H15l3.5-5.5Z"
        fill="#2BA44F"
      />
      <circle cx="12" cy="12" r="2" fill="#fff" />
    </svg>
  );
}

export function StsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="7.5" fill="currentColor" fillOpacity="0.1" />
      <path d="M12 7v5l3.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

export const TOOL_ICON_MAP: Record<string, (props: IconProps) => JSX.Element> = {
  JIRA: JiraIcon,
  ZohoPeople: ZohoIcon,
  ZohoCRM: ZohoIcon,
  ZohoRecruit: ZohoIcon,
  ZohoContracts: ZohoIcon,
  STS: StsIcon,
  Teamwork: TeamworkIcon,
  Outlook: OutlookIcon,
};
