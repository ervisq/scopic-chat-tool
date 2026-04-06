const ACCOUNTS_TO_SUFFIX: Record<string, string> = {
  "https://accounts.zoho.com": ".com",
  "https://accounts.zoho.in": ".in",
  "https://accounts.zoho.eu": ".eu",
  "https://accounts.zoho.com.au": ".com.au",
  "https://accounts.zoho.jp": ".jp",
  "https://accounts.zoho.com.cn": ".com.cn",
  "https://accounts.zohocloud.ca": ".ca",
};

function getDomainSuffix(accountsDomain: string): string {
  const normalized = accountsDomain.replace(/\/$/, "").toLowerCase();
  return ACCOUNTS_TO_SUFFIX[normalized] || ".com";
}

export function getRecruitBaseUrl(accountsDomain: string): string {
  const suffix = getDomainSuffix(accountsDomain);
  if (suffix === ".ca") return "https://recruit.zohocloud.ca/recruit/v2";
  return `https://recruit.zoho${suffix}/recruit/v2`;
}

export function getContractsBaseUrl(accountsDomain: string): string {
  const suffix = getDomainSuffix(accountsDomain);
  if (suffix === ".ca") return "https://contracts.zohocloud.ca/api/v1";
  return `https://contracts.zoho${suffix}/api/v1`;
}
