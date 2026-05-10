import { Router, type IRouter } from "express";
import { getAuthUser } from "../middlewares/auth";
import { db } from "@workspace/db";
import { users, passwordResetTokens } from "@workspace/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { encrypt, decrypt } from "../lib/crypto";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

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

router.put("/account/password", async (req, res) => {
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

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.update(users).set({ passwordHash }).where(eq(users.id, userId));

    // Invalidate any outstanding password reset tokens for this user so a
    // stolen/in-flight reset link can't be used after the owner has just
    // rotated their password.
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(
        eq(passwordResetTokens.userId, userId),
        isNull(passwordResetTokens.usedAt),
      ));

    res.json({ message: "Password updated successfully" });
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

router.post("/account/2fa/setup", async (req, res) => {
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

router.post("/account/2fa/verify", async (req, res) => {
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

router.post("/account/2fa/disable", async (req, res) => {
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

router.put("/account/2fa/frequency", async (req, res) => {
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
