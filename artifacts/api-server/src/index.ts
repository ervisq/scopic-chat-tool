import app from "./app";
import { getPasswordResetMailerStatus } from "./services/passwordResetMailer";
import { startPasswordResetCleanupJob } from "./services/passwordResetCleanup";

// Boot-time check: warn loudly if the password-reset email pipeline
// isn't configured. Forgot-password requests will still respond with
// the generic 200 (so they don't leak account existence), but reset
// emails simply won't go out until these are set.
{
  const mailerStatus = getPasswordResetMailerStatus();
  if (!mailerStatus.ok) {
    console.warn(
      `[boot] Password reset emails are DISABLED: ${mailerStatus.reason}. ` +
      `Set MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and PASSWORD_RESET_FROM_EMAIL to enable.`
    );
  }
  if (!process.env.PUBLIC_APP_URL) {
    console.warn(
      "[boot] PUBLIC_APP_URL is not set. Forgot-password reset links cannot be built; " +
      "no reset emails will be sent until you set PUBLIC_APP_URL (e.g. https://aichat.scopicsoftware.com)."
    );
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

startPasswordResetCleanupJob();
