import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function JiraIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="jiraGradBlue1" x1="102.4" y1="142.4" x2="56.6" y2="193.6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0052CC" />
          <stop offset="0.92" stopColor="#2684FF" />
        </linearGradient>
        <linearGradient id="jiraGradBlue2" x1="154.3" y1="113" x2="198.8" y2="63.2" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0052CC" />
          <stop offset="0.92" stopColor="#2684FF" />
        </linearGradient>
      </defs>
      <path d="M244.658 0H121.707a55.502 55.502 0 0 0 55.502 55.502h22.649V77.37c.02 30.625 24.841 55.447 55.466 55.502V10.666C255.324 4.777 250.55 0 244.658 0Z" fill="#2684FF" />
      <path d="M183.822 61.262H60.872c.019 30.625 24.84 55.447 55.466 55.502h22.648v21.868c.02 30.597 24.798 55.426 55.396 55.502V71.928c0-5.891-4.776-10.666-10.56-10.666Z" fill="url(#jiraGradBlue2)" />
      <path d="M122.951 122.489H0c0 30.653 24.85 55.502 55.502 55.502h22.72v21.796c.02 30.625 24.824 55.447 55.43 55.502V133.155c0-5.891-4.81-10.666-10.701-10.666Z" fill="url(#jiraGradBlue1)" />
    </svg>
  );
}

export function TeamworkIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect width="256" height="256" rx="48" fill="#6B46C1" />
      <g fill="#fff">
        <circle cx="100" cy="80" r="20" />
        <circle cx="156" cy="80" r="20" />
        <rect x="80" y="112" width="40" height="72" rx="8" />
        <rect x="136" y="112" width="40" height="72" rx="8" />
        <rect x="116" y="128" width="24" height="56" rx="6" />
      </g>
    </svg>
  );
}

export function OutlookIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M148 28v72h92V52c0-13.2-10.8-24-24-24h-68Z" fill="#1490DF" />
      <path d="M240 100H148v72h92V100Z" fill="#28A8EA" />
      <path d="M148 172v56h68c13.2 0 24-10.8 24-24v-32h-92Z" fill="#0078D4" />
      <path d="M148 100v72h92V100H148Z" fill="#0364B8" fillOpacity="0.2" />
      <rect x="16" y="48" width="136" height="160" rx="16" fill="#0078D4" />
      <path d="M84 98c-22.1 0-40 17.9-40 40s17.9 40 40 40 40-17.9 40-40-17.9-40-40-40Zm0 64c-13.3 0-24-10.7-24-24s10.7-24 24-24 24 10.7 24 24-10.7 24-24 24Z" fill="#fff" />
    </svg>
  );
}

export function ZohoIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M20 68h72L20 168h72" stroke="#E8443A" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <ellipse cx="158" cy="128" rx="52" ry="52" fill="#F0C021" />
      <ellipse cx="158" cy="128" rx="28" ry="28" fill="#fff" />
      <path d="M200 88h44l-44 80h44" stroke="#2BA44F" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function StsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="7.5" fill="currentColor" fillOpacity="0.08" />
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
