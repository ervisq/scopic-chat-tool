import { getGraphClient, isGraphConfigured } from "./microsoftGraphClient";

const FROM_EMAIL = process.env.PASSWORD_RESET_FROM_EMAIL || "";

export function isPasswordResetMailerConfigured(): boolean {
  return isGraphConfigured() && !!FROM_EMAIL;
}

export function getPasswordResetMailerStatus(): { ok: boolean; reason?: string } {
  if (!isGraphConfigured()) {
    return { ok: false, reason: "Microsoft Graph not configured (MICROSOFT_TENANT_ID / MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET)" };
  }
  if (!FROM_EMAIL) {
    return { ok: false, reason: "PASSWORD_RESET_FROM_EMAIL is not set" };
  }
  return { ok: true };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "\"": return "&quot;";
      case "'": return "&#39;";
      default: return ch;
    }
  });
}

function buildHtml(resetUrl: string): string {
  const safeUrl = escapeHtml(resetUrl);
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1f2e;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
            <tr><td>
              <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#1a1f2e;">Reset your AI Chat password</h1>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#4a5568;">
                We received a request to reset the password for your AI Chat account.
                Click the button below to choose a new password. This link is valid for
                <strong>1 hour</strong> and can only be used once.
              </p>
              <p style="margin:24px 0;text-align:center;">
                <a href="${safeUrl}" style="display:inline-block;padding:12px 24px;background:#3b82f6;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">Reset password</a>
              </p>
              <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">Or paste this link into your browser:</p>
              <p style="margin:0 0 24px;font-size:13px;color:#3b82f6;word-break:break-all;">${safeUrl}</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
              <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">
                If you didn't request a password reset, you can safely ignore this email — your password will not be changed.
              </p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildText(resetUrl: string): string {
  return `Reset your AI Chat password

We received a request to reset the password for your AI Chat account.
Open the link below to choose a new password. This link is valid for 1 hour and can only be used once.

${resetUrl}

If you didn't request a password reset, you can safely ignore this email — your password will not be changed.`;
}

export async function sendPasswordResetEmail(toEmail: string, resetUrl: string): Promise<void> {
  const status = getPasswordResetMailerStatus();
  if (!status.ok) {
    throw new Error(`Password reset mailer not configured: ${status.reason}`);
  }

  const client = getGraphClient();
  const message = {
    message: {
      subject: "Reset your AI Chat password",
      body: { contentType: "HTML", content: buildHtml(resetUrl) },
      toRecipients: [{ emailAddress: { address: toEmail } }],
    },
    saveToSentItems: false,
  };

  try {
    await client.api(`/users/${encodeURIComponent(FROM_EMAIL)}/sendMail`).post(message);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; code?: string; message?: string };
    const status = e.statusCode || 0;
    const code = e.code || "";
    if (status === 403 || /Forbidden|Authorization|Permission/i.test(code) || /Mail\.Send/i.test(e.message || "")) {
      throw new Error(
        `Microsoft Graph rejected sendMail (${status} ${code}). The Azure app registration likely needs the 'Mail.Send' application permission, granted with admin consent in the Azure portal. Underlying error: ${e.message || code || "unknown"}`
      );
    }
    throw err;
  }
}
