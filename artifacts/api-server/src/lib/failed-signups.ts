export interface FailedSignupEntry {
  timestamp: string;
  redactedEmail: string;
  reason: string;
  ip: string;
}

const MAX_ENTRIES = 50;
const buffer: FailedSignupEntry[] = [];

export function recordFailedSignup(entry: Omit<FailedSignupEntry, "timestamp">): void {
  buffer.push({ ...entry, timestamp: new Date().toISOString() });
  if (buffer.length > MAX_ENTRIES) {
    buffer.splice(0, buffer.length - MAX_ENTRIES);
  }
}

export function getFailedSignups(): FailedSignupEntry[] {
  return buffer.slice().reverse();
}
