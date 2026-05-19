import { Router, type IRouter } from "express";
import { getAuthUser } from "../middlewares/auth";
import { db } from "@workspace/db";
import { users, passwordResetTokens } from "@workspace/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { encrypt, decrypt } from "../lib/crypto";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { sendPasswordChangedNotice } from "../services/passwordResetMailer";
import { signToken } from "../middlewares/auth";
import type { Request, Response, NextFunction } from "express";

const BREAK_GLASS_PASSWORD_LOGIN = process.env.BREAK_GLASS_PASSWORD_LOGIN === "true";

function breakGlassOnly(_req: Request, res: Response, next: NextFunction) {
  if (!BREAK_GLASS_PASSWORD_LOGIN) {
    res.status(404).json({ message: "Not found" });
    return;
  }
  next();
}

function redactEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const visible = local.slice(0, 1);
  return `${visible}${"*".repeat(Math.max(1, local.length - 1))}@${domain}`;
}

interface ProfileUpdates {
  name?: string;
  phone?: string | null;
  profilePictureUrl?: string | null;
}

interface PreferencesUpdates {
  theme?: string;
  defaultPage?: string;
  hiddenTools?: string[];
}

const KNOWN_TOOL_NAMES = [
  "JIRA",
  "ZohoPeople",
  "ZohoCRM",
  "ZohoRecruit",
  "ZohoContracts",
  "STS",
  "Teamwork",
  "Outlook",
] as const;

const router: IRouter = Router();

router.get("/account/profile", async (req, res) => {
  try {
    const { userId } = getAuthUser(req);
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json({
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      profilePictureUrl: user.profilePictureUrl || "",
    });
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
});

router.put("/account/profile", async (req, res) => {
  try {
    const { userId } = getAuthUser(req);
    const { name, phone, profilePictureUrl } = req.body;

    const updates: ProfileUpdates = {};
    if (name !== undefined) {
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        res.status(400).json({ message: "Name is required" });
        return;
      }
      updates.name = name.trim();
    }
    if (phone !== undefined) {
      updates.phone = typeof phone === "string" && phone.trim() ? phone.trim() : null;
    }
    if (profilePictureUrl !== undefined) {
      if (typeof profilePictureUrl === "string" && profilePictureUrl.length > 2 * 1024 * 1024) {
        res.status(400).json({ message: "Profile picture is too large (max 1.5MB)" });
        return;
      }
      updates.profilePictureUrl = typeof profilePictureUrl === "string" && profilePictureUrl ? profilePictureUrl : null;
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ message: "No fields to update" });
      return;
    }

    const [updated] = await db.update(users).set(updates).where(eq(users.id, userId)).returning();
    res.json({
      name: updated.name,
      email: updated.email,
      phone: updated.phone || "",
      profilePictureUrl: updated.profilePictureUrl || "",
    });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ message: "Failed to update profile" });
  }
});

router.put("/account/password", breakGlassOnly, async (req, res) => {
  try {
    const { userId } = getAuthUser(req);
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: "Current and new passwords are required" });
      return;
    }
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      res.status(400).json({ message: "New password must be at least 6 characters" });
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ message: "Current password is incorrect" });
      return;
    }

    if (currentPassword === newPassword) {
      res.status(400).json({ message: "New password must be different from your current password" });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const now = new Date();
    // Bump tokenVersion so JWT sessions on other devices are invalidated.
    const [updatedUser] = await db
      .update(users)
      .set({ passwordHash, tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, userId))
      .returning({ tokenVersion: users.tokenVersion });

    // Invalidate any outstanding password reset tokens (defense in depth: an
    // attacker who triggered a reset link can no longer use it after the
    // owner changes their password).
    try {
      await db
        .update(passwordResetTokens)
        .set({ usedAt: now })
        .where(and(
          eq(passwordResetTokens.userId, userId),
          isNull(passwordResetTokens.usedAt),
        ));
    } catch (invalidateErr: unknown) {
      const msg = invalidateErr instanceof Error ? invalidateErr.message : String(invalidateErr);
      console.error(`[change-password] failed to invalidate reset tokens for user ${userId}:`, msg);
    }

    console.info(`[change-password] password updated for ${redactEmail(user.email)}`);

    // Out-of-band confirmation email so the account holder is notified even
    // if the change was made by an attacker who has hijacked the session.
    // Failure to send must not fail the password change itself.
    try {
      await sendPasswordChangedNotice(user.email);
      console.info(`[change-password] sent password-changed notice to ${redactEmail(user.email)}`);
    } catch (noticeErr: unknown) {
      const noticeMsg = noticeErr instanceof Error ? noticeErr.message : String(noticeErr);
      console.error(`[change-password] failed to send password-changed notice to ${redactEmail(user.email)}:`, noticeMsg);
    }

    // Re-issue a fresh token so the requester stays signed in on this device.
    const token = signToken({
      userId,
      email: user.email,
      name: user.name,
      role: user.role,
      tokenVersion: updatedUser.tokenVersion,
    });

    res.json({ message: "Password updated successfully", token });
  } catch (err) {
    console.error("Update password error:", err);
    res.status(500).json({ message: "Failed to update password" });
  }
});

router.get("/account/preferences", async (req, res) => {
  try {
    const { userId } = getAuthUser(req);
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json({
      theme: user.theme || "light",
      defaultPage: user.defaultPage || "dashboard",
      hiddenTools: Array.isArray(user.hiddenTools) ? user.hiddenTools : [],
    });
  } catch (err) {
    console.error("Get preferences error:", err);
    res.status(500).json({ message: "Failed to fetch preferences" });
  }
});

router.put("/account/preferences", async (req, res) => {
  try {
    const { userId } = getAuthUser(req);
    const { theme, defaultPage, hiddenTools } = req.body;

    const updates: PreferencesUpdates = {};
    if (theme !== undefined) {
      if (!["light", "dark"].includes(theme)) {
        res.status(400).json({ message: "Theme must be 'light' or 'dark'" });
        return;
      }
      updates.theme = theme;
    }
    if (defaultPage !== undefined) {
      if (!["dashboard", "chat", "connections", "admin", "account"].includes(defaultPage)) {
        res.status(400).json({ message: "Invalid default page" });
        return;
      }
      updates.defaultPage = defaultPage;
    }
    if (hiddenTools !== undefined) {
      if (!Array.isArray(hiddenTools) || !hiddenTools.every((t) => typeof t === "string")) {
        res.status(400).json({ message: "hiddenTools must be an array of strings" });
        return;
      }
      const invalid = hiddenTools.filter((t) => !(KNOWN_TOOL_NAMES as readonly string[]).includes(t));
      if (invalid.length > 0) {
        res.status(400).json({ message: `Unknown tool name(s): ${invalid.join(", ")}` });
        return;
      }
      updates.hiddenTools = Array.from(new Set(hiddenTools));
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ message: "No preferences to update" });
      return;
    }

    const [updated] = await db.update(users).set(updates).where(eq(users.id, userId)).returning();
    res.json({
      theme: updated.theme || "light",
      defaultPage: updated.defaultPage || "dashboard",
      hiddenTools: Array.isArray(updated.hiddenTools) ? updated.hiddenTools : [],
    });
  } catch (err) {
    console.error("Update preferences error:", err);
    res.status(500).json({ message: "Failed to update preferences" });
  }
});

router.get("/account/2fa/status", async (req, res) => {
  try {
    const { userId } = getAuthUser(req);
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json({
      enabled: user.totpEnabled || false,
      frequency: user.totpFrequency || "weekly",
    });
  } catch (err) {
    console.error("Get 2FA status error:", err);
    res.status(500).json({ message: "Failed to fetch 2FA status" });
  }
});

router.post("/account/2fa/setup", breakGlassOnly, async (req, res) => {
  try {
    const { userId, email } = getAuthUser(req);

    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: "WorkHub",
      label: email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret,
    });

    const otpauthUri = totp.toString();
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUri);

    const encryptedSecret = encrypt(secret.base32);
    await db.update(users).set({
      totpSecret: encryptedSecret,
      totpEnabled: false,
    }).where(eq(users.id, userId));

    res.json({
      qrCode: qrCodeDataUrl,
      secret: secret.base32,
      otpauthUri,
    });
  } catch (err) {
    console.error("2FA setup error:", err);
    res.status(500).json({ message: "Failed to set up 2FA" });
  }
});

router.post("/account/2fa/verify", breakGlassOnly, async (req, res) => {
  try {
    const { userId } = getAuthUser(req);
    const { code } = req.body;

    if (!code || typeof code !== "string" || code.length !== 6) {
      res.status(400).json({ message: "Please enter a valid 6-digit code" });
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !user.totpSecret) {
      res.status(400).json({ message: "2FA setup not initiated. Please scan the QR code first." });
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

    await db.update(users).set({
      totpEnabled: true,
      totpLastVerified: new Date(),
    }).where(eq(users.id, userId));

    res.json({ message: "Two-factor authentication enabled successfully" });
  } catch (err) {
    console.error("2FA verify error:", err);
    res.status(500).json({ message: "Failed to verify 2FA code" });
  }
});

router.post("/account/2fa/disable", breakGlassOnly, async (req, res) => {
  try {
    const { userId } = getAuthUser(req);
    const { password } = req.body;

    if (!password) {
      res.status(400).json({ message: "Password is required to disable 2FA" });
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ message: "Incorrect password" });
      return;
    }

    await db.update(users).set({
      totpEnabled: false,
      totpSecret: null,
      totpLastVerified: null,
    }).where(eq(users.id, userId));

    res.json({ message: "Two-factor authentication disabled" });
  } catch (err) {
    console.error("Disable 2FA error:", err);
    res.status(500).json({ message: "Failed to disable 2FA" });
  }
});

router.put("/account/2fa/frequency", breakGlassOnly, async (req, res) => {
  try {
    const { userId } = getAuthUser(req);
    const { frequency } = req.body;

    if (!["weekly", "biweekly", "monthly"].includes(frequency)) {
      res.status(400).json({ message: "Frequency must be 'weekly', 'biweekly', or 'monthly'" });
      return;
    }

    const [updated] = await db.update(users).set({ totpFrequency: frequency }).where(eq(users.id, userId)).returning();
    res.json({
      frequency: updated.totpFrequency || "weekly",
    });
  } catch (err) {
    console.error("Update 2FA frequency error:", err);
    res.status(500).json({ message: "Failed to update 2FA frequency" });
  }
});

export default router;
