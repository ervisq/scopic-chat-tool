import { getUserCredentials } from "../lib/credential-store";

export class TeamworkPermissionError extends Error {
  public readonly httpStatus: number;
  constructor(message: string, httpStatus: number) {
    super(message);
    this.name = "TeamworkPermissionError";
    this.httpStatus = httpStatus;
  }
}

export interface TeamworkCredentials {
  accessToken: string;
  siteUrl: string;
}

/**
 * Reads the user's Teamwork credentials from the credential store.
 * Teamwork Launchpad OAuth issues long-lived access tokens (no refresh token),
 * so this is a thin wrapper over the credential store. If the token is revoked
 * later, callers will see a 401 on API calls and should surface a reconnect
 * prompt by throwing/translating to TeamworkPermissionError.
 */
export async function getTeamworkCredentials(userId: number): Promise<TeamworkCredentials | null> {
  const cred = await getUserCredentials(userId, "teamwork");
  if (!cred) return null;

  const accessToken = cred.credentials?.accessToken as string | undefined;
  const siteUrl = cred.instanceUrl;

  if (!accessToken || !siteUrl) return null;

  return { accessToken, siteUrl };
}
