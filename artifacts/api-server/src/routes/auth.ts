import { Router, type IRouter } from "express";
import { LoginBody, LoginResponse, GetMeResponse } from "@workspace/api-zod";
import { signToken, requireAuth } from "../middlewares/auth";
import { db } from "@workspace/db";
import { users } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const router: IRouter = Router();

router.post("/auth/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({ message: "Email, password, and name are required" });
      return;
    }

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ message: "An account with this email already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(users).values({ email, passwordHash, name }).returning();

    const token = signToken({ userId: user.id, email: user.email, name: user.name });

    res.status(201).json({
      token,
      user: { email: user.email, name: user.name },
    });
  } catch (error: any) {
    console.error("Registration error:", error?.message);
    res.status(500).json({ message: "Registration failed. Please try again." });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = LoginBody.parse(req.body);

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

    const token = signToken({ userId: user.id, email: user.email, name: user.name });

    const data = LoginResponse.parse({ token, user: { email: user.email, name: user.name } });
    res.json(data);
  } catch (error: any) {
    console.error("Login error:", error?.message);
    res.status(500).json({ message: "Login failed. Please try again." });
  }
});

router.get("/auth/me", requireAuth, (req, res) => {
  const user = (req as any).user;
  const data = GetMeResponse.parse({ email: user.email, name: user.name });
  res.json(data);
});

export default router;
