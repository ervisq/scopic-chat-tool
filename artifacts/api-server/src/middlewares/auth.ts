import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { users } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

export interface AuthPayload {
  userId: number;
  email: string;
  name: string;
  role?: string;
  tokenVersion?: number;
  tokenType?: "session" | "2fa_pending";
}

export interface AuthenticatedRequest extends Request {
  user: AuthPayload;
}

export function getAuthUser(req: Request): AuthPayload {
  return (req as AuthenticatedRequest).user;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign({ ...payload, tokenType: "session" }, JWT_SECRET!, { expiresIn: "30d" });
}

export function sign2faPendingToken(payload: Omit<AuthPayload, "tokenType">): string {
  return jwt.sign({ ...payload, tokenType: "2fa_pending" }, JWT_SECRET!, { expiresIn: "10m" });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET!) as AuthPayload;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  let payload: AuthPayload;
  try {
    const token = header.slice(7);
    payload = verifyToken(token);
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }

  if (!payload.userId || typeof payload.userId !== "number") {
    res.status(401).json({ message: "Session expired. Please log in again." });
    return;
  }
  if (payload.tokenType === "2fa_pending") {
    res.status(403).json({ message: "Two-factor authentication required. Please verify your identity." });
    return;
  }

  try {
    const [user] = await db
      .select({ tokenVersion: users.tokenVersion })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);
    if (!user) {
      res.status(401).json({ message: "Session expired. Please log in again." });
      return;
    }
    const tokenVersion = payload.tokenVersion ?? 0;
    if (tokenVersion !== user.tokenVersion) {
      res.status(401).json({ message: "Your session has been signed out. Please log in again." });
      return;
    }
  } catch (err) {
    console.error("[requireAuth] failed to verify token version:", err);
    res.status(500).json({ message: "Authentication check failed" });
    return;
  }

  (req as AuthenticatedRequest).user = payload;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authUser = getAuthUser(req);
  try {
    const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, authUser.userId)).limit(1);
    if (!user || user.role !== "admin") {
      res.status(403).json({ message: "Admin access required" });
      return;
    }
    next();
  } catch {
    res.status(500).json({ message: "Failed to verify admin status" });
  }
}
