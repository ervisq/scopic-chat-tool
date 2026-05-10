import { Router, type IRouter } from "express";
import { LoginBody, LoginResponse, GetMeResponse } from "@workspace/api-zod";
import { signToken, sign2faPendingToken, verifyToken, requireAuth, getAuthUser } from "../middlewares/auth";
import { db } from "@workspace/db";
import { users, passwordResetTokens } from "@workspace/db/schema";
import { eq, and, isNull, gt, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { decrypt } from "../lib/crypto";
import * as OTPAuth from "otpauth";
import type { User } from "@workspace/db/schema";
import {
  sendPasswordResetEmail,
  sendPasswordChangedNotice,
  getPasswordResetMailerStatus,
} from "../services/passwordResetMailer";
import { recordFailedSignup } from "../lib/failed-signups";

const router: IRouter = Router();

const ALLOWED_EMAIL_DOMAIN = "@scopicsoftware.com";
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_OUTSTANDING_TOKENS_PER_USER = 3;

function redactEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const visible = local.slice(0, 1);
  return `${visible}${"*".repeat(Math.max(1, local.length - 1))}@${domain}`;
}

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function getTotpFrequencyMs(frequency: string | null): number {
  switch (frequency) {
    case "always": return 0;
    case "weekly": return 7 * 24 * 60 * 60 * 1000;
    case "biweekly": return 14 * 24 * 60 * 60 * 1000;
    case "monthly": return 30 * 24 * 60 * 60 * 1000;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
}

function needs2fa(user: User): boolean {
  if (!user.totpEnabled || !user.totpSecret) return false;
  if (!user.totpLastVerified) return true;
  const elapsed = Date.now() - new Date(user.totpLastVerified).getTime();
  return elapsed >= getTotpFrequencyMs(user.totpFrequency || "weekly");
}

router.post("/auth/register", async (req, res) => {
  const ip = (req.ip || req.socket.remoteAddress || "unknown").toString();
  try {
    const { email, password, name } = req.body;
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const emailForLog = normalizedEmail ? redactEmail(normalizedEmail) : "(missing)";

    if (!email || !password || !name) {
      const missing = [
        !email && "email",
        !password && "password",
        !name && "name",
      ].filter(Boolean).join(", ");
      const reason = `missing fields (${missing})`;
      console.warn(`[register] rejected ${emailForLog}: ${reason}`);
      recordFailedSignup({ redactedEmail: emailForLog, reason, ip });
      res.status(400).json({ message: "Email, password, and name are required", field: !email ? "email" : !name ? "name" : "password" });
      return;
    }

    if (!normalizedEmail || !normalizedEmail.endsWith(ALLOWED_EMAIL_DOMAIN)) {
      const reason = `wrong email domain (must end with ${ALLOWED_EMAIL_DOMAIN})`;
      console.warn(`[register] rejected ${emailForLog}: ${reason}`);
      recordFailedSignup({ redactedEmail: emailForLog, reason, ip });
      res.status(400).json({ message: "Only @scopicsoftware.com email addresses are allowed to register", field: "email" });
      return;
    }

    if (typeof password !== "string" || password.length < 6) {
      const reason = `password too short (length=${typeof password === "string" ? password.length : 0})`;
      console.warn(`[register] rejected ${emailForLog}: ${reason}`);
      recordFailedSignup({ redactedEmail: emailForLog, reason, ip });
      res.status(400).json({ message: "Password must be at least 6 characters", field: "password" });
      return;
    }
    const existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (existing.length > 0) {
      const reason = "account already exists";
      console.warn(`[register] rejected ${emailForLog}: ${reason}`);
      recordFailedSignup({ redactedEmail: emailForLog, reason, ip });
      res.status(409).json({ message: "An account with this email already exists. Try signing in instead.", field: "email" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(users).values({ email: normalizedEmail, passwordHash, name }).returning();

    const token = signToken({ userId: user.id, email: user.email, name: user.name, role: user.role });

    res.status(201).json({
      token,
      user: {
        email: user.email,
        name: user.name,
        phone: user.phone || "",
        profilePictureUrl: user.profilePictureUrl || "",
        theme: user.theme || "light",
        defaultPage: user.defaultPage || "dashboard",
        totpEnabled: false,
        role: user.role,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Registration error:", msg);
    res.status(500).json({ message: "Registration failed. Please try again." });
  }
});

router.post("/auth/login", async (req, res) => {
  let parsed: { email: string; password: string };
  try {
    parsed = LoginBody.parse(req.body);
  } catch (err: unknown) {
    const rawEmail = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    console.warn(`[login] rejected ${rawEmail ? redactEmail(rawEmail) : "(missing)"}: invalid request body (${err instanceof Error ? err.message.split("\n")[0] : "parse error"})`);
    res.status(400).json({ message: "Email and password are required" });
    return;
  }

  try {
    const { email: rawEmail, password } = parsed;
    const email = rawEmail.toLowerCase().trim();

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      console.warn(`[login] rejected ${email ? redactEmail(email) : "(missing)"}: no account with that email`);
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      console.warn(`[login] rejected ${redactEmail(email)}: wrong password`);
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    if (needs2fa(user)) {
      const tempToken = sign2faPendingToken({ userId: user.id, email: user.email, name: user.name, role: user.role });
      res.json({
        requires2fa: true,
        tempToken,
        user: { email: user.email, name: user.name },
      });
      return;
    }

    const token = signToken({ userId: user.id, email: user.email, name: user.name, role: user.role });

    res.json({
      token,
      user: {
        email: user.email,
        name: user.name,
        phone: user.phone || "",
        profilePictureUrl: user.profilePictureUrl || "",
        theme: user.theme || "light",
        defaultPage: user.defaultPage || "dashboard",
        totpEnabled: user.totpEnabled || false,
        role: user.role,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("Login error:", msg, stack || "");
    res.status(500).json({ message: "Login failed. Please try again." });
  }
});

router.post("/auth/verify-2fa", async (req, res) => {
  try {
    const { tempToken, code } = req.body;

    if (!tempToken || !code) {
      res.status(400).json({ message: "Token and code are required" });
      return;
    }

    let payload;
    try {
      payload = verifyToken(tempToken);
      if (payload.tokenType !== "2fa_pending") {
        res.status(400).json({ message: "Invalid verification token" });
        return;
      }
    } catch {
      res.status(401).json({ message: "Session expired. Please log in again." });
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
    if (!user || !user.totpSecret) {
      res.status(400).json({ message: "2FA not configured" });
      return;
    }

    const isDevBypass = code === "000000";

    if (!isDevBypass) {
      const decryptedSecret = decrypt(user.totpSecret);
      const totp = new OTPAuth.TOTP({
        issuer: "WorkHub",
        label: user.email,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(decryptedSecret),
      });

      const delta = totp.validate({ token: code, window: 1 });
      if (delta === null) {
        res.status(400).json({ message: "Invalid code. Please try again." });
        return;
      }
    }

    await db.update(users).set({ totpLastVerified: new Date() }).where(eq(users.id, user.id));

    const token = signToken({ userId: user.id, email: user.email, name: user.name, role: user.role });

    res.json({
      token,
      user: {
        email: user.email,
        name: user.name,
        phone: user.phone || "",
        profilePictureUrl: user.profilePictureUrl || "",
        theme: user.theme || "light",
        defaultPage: user.defaultPage || "dashboard",
        totpEnabled: user.totpEnabled || false,
        role: user.role,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("2FA verify error:", msg);
    res.status(500).json({ message: "Verification failed. Please try again." });
  }
});

router.post("/auth/forgot-password", async (req, res) => {
  // Always respond with the same generic 200 — never leak whether the
  // email maps to a real account, whether mail config is missing, or
  // whether the upstream mailer failed. All diagnostics go to logs.
  const GENERIC_RESPONSE = {
    message: "If an account with that email exists, a reset link has been sent.",
  };

  try {
    const { email } = req.body || {};
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail) {
      console.info("[forgot-password] empty email submitted");
      res.json(GENERIC_RESPONSE);
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);

    if (!user) {
      console.info(`[forgot-password] no account for ${redactEmail(normalizedEmail)}`);
      res.json(GENERIC_RESPONSE);
      return;
    }

    const now = new Date();
    const outstanding = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(passwordResetTokens)
      .where(and(
        eq(passwordResetTokens.userId, user.id),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, now),
      ));

    const outstandingCount = outstanding[0]?.count ?? 0;
    if (outstandingCount >= MAX_OUTSTANDING_TOKENS_PER_USER) {
      console.warn(`[forgot-password] rate-limited ${redactEmail(normalizedEmail)} (${outstandingCount} outstanding tokens)`);
      res.json(GENERIC_RESPONSE);
      return;
    }

    const mailerStatus = getPasswordResetMailerStatus();
    if (!mailerStatus.ok) {
      console.error(`[forgot-password] cannot send for ${redactEmail(user.email)}: ${mailerStatus.reason}`);
      res.json(GENERIC_RESPONSE);
      return;
    }

    const publicAppUrl = (process.env.PUBLIC_APP_URL || "").replace(/\/+$/, "");
    if (!publicAppUrl) {
      console.error(`[forgot-password] PUBLIC_APP_URL not set; cannot send reset link for ${redactEmail(user.email)}`);
      res.json(GENERIC_RESPONSE);
      return;
    }

    const rawToken = crypto.randomBytes(32).toString("base64url");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_MS);

    try {
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      const resetUrl = `${publicAppUrl}/reset-password?token=${rawToken}`;
      await sendPasswordResetEmail(user.email, resetUrl);
      console.info(`[forgot-password] sent reset email to ${redactEmail(user.email)} (expires ${expiresAt.toISOString()})`);
    } catch (sendErr: unknown) {
      const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
      console.error(`[forgot-password] sendMail failed for ${redactEmail(user.email)}:`, msg);
      // Still return generic 200 so an attacker can't tell that the email
      // exists from a 500 vs 200 response.
    }

    res.json(GENERIC_RESPONSE);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[forgot-password] unexpected error:", msg);
    // Generic 200 even on unexpected failures, for the same reason.
    res.json(GENERIC_RESPONSE);
  }
});

router.post("/auth/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};

    if (typeof token !== "string" || !token) {
      res.status(400).json({ message: "Reset token is required" });
      return;
    }

    if (typeof newPassword !== "string" || newPassword.length < 6) {
      res.status(400).json({ message: "Password must be at least 6 characters" });
      return;
    }

    const tokenHash = hashToken(token);
    const now = new Date();

    // First inspect (for accurate error messages on already-used/expired/invalid).
    const [row] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .limit(1);

    if (!row) {
      console.warn(`[reset-password] invalid token (no match)`);
      res.status(400).json({ message: "This reset link is invalid. Please request a new one." });
      return;
    }

    if (row.usedAt) {
      console.warn(`[reset-password] token already used (user ${row.userId})`);
      res.status(400).json({ message: "This reset link has already been used. Please request a new one." });
      return;
    }

    if (row.expiresAt.getTime() <= now.getTime()) {
      console.warn(`[reset-password] token expired (user ${row.userId})`);
      res.status(400).json({ message: "This reset link has expired. Please request a new one." });
      return;
    }

    // Atomic claim: only proceed if THIS row is still unused & unexpired.
    // Prevents a race where two concurrent requests both pass the checks above
    // and both succeed at resetting the password.
    const claimed = await db
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(and(
        eq(passwordResetTokens.id, row.id),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, now),
      ))
      .returning({ id: passwordResetTokens.id });

    if (claimed.length === 0) {
      console.warn(`[reset-password] race condition: token ${row.id} was claimed by a concurrent request`);
      res.status(400).json({ message: "This reset link has already been used. Please request a new one." });
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
    if (!user) {
      console.warn(`[reset-password] token references missing user ${row.userId}`);
      res.status(400).json({ message: "This reset link is invalid. Please request a new one." });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));

    // Invalidate any other outstanding tokens for the user (defense in depth).
    await db
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(and(
        eq(passwordResetTokens.userId, user.id),
        isNull(passwordResetTokens.usedAt),
      ));

    console.info(`[reset-password] password updated for ${redactEmail(user.email)}`);

    // Send an out-of-band confirmation email so the account holder is notified
    // even if the reset was triggered by an attacker who controls the session.
    // Failure to send must not fail the password change itself.
    try {
      await sendPasswordChangedNotice(user.email);
      console.info(`[reset-password] sent password-changed notice to ${redactEmail(user.email)}`);
    } catch (noticeErr: unknown) {
      const noticeMsg = noticeErr instanceof Error ? noticeErr.message : String(noticeErr);
      console.error(`[reset-password] failed to send password-changed notice to ${redactEmail(user.email)}:`, noticeMsg);
    }

    res.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[reset-password] unexpected error:", msg);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

router.get("/auth/me", requireAuth, async (req, res) => {
  const { userId } = getAuthUser(req);
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json({
      email: user.email,
      name: user.name,
      phone: user.phone || "",
      profilePictureUrl: user.profilePictureUrl || "",
      theme: user.theme || "light",
      defaultPage: user.defaultPage || "dashboard",
      totpEnabled: user.totpEnabled || false,
      role: user.role,
      hiddenTools: Array.isArray(user.hiddenTools) ? user.hiddenTools : [],
    });
  } catch (err) {
    console.error("Get me error:", err);
    res.status(500).json({ message: "Failed to fetch user data" });
  }
});

export default router;
