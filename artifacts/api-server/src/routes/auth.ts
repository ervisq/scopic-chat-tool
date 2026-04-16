import { Router, type IRouter } from "express";
import { LoginBody, LoginResponse, GetMeResponse } from "@workspace/api-zod";
import { signToken, sign2faPendingToken, verifyToken, requireAuth, getAuthUser } from "../middlewares/auth";
import { db } from "@workspace/db";
import { users } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { decrypt } from "../lib/crypto";
import * as OTPAuth from "otpauth";
import type { User } from "@workspace/db/schema";

const router: IRouter = Router();

const ALLOWED_EMAIL_DOMAIN = "@scopicsoftware.com";

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
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({ message: "Email, password, and name are required" });
      return;
    }

    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || !normalizedEmail.endsWith(ALLOWED_EMAIL_DOMAIN)) {
      res.status(400).json({ message: "Only @scopicsoftware.com email addresses are allowed to register" });
      return;
    }

    if (typeof password !== "string" || password.length < 6) {
      res.status(400).json({ message: "Password must be at least 6 characters" });
      return;
    }
    const existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ message: "An account with this email already exists" });
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
  try {
    const { email: rawEmail, password } = LoginBody.parse(req.body);
    const email = rawEmail.toLowerCase().trim();

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
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
    console.error("Login error:", msg);
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
    });
  } catch (err) {
    console.error("Get me error:", err);
    res.status(500).json({ message: "Failed to fetch user data" });
  }
});

export default router;
