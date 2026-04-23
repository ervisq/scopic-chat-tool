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

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  try {
    const token = header.slice(7);
    const payload = verifyToken(token);
    if (!payload.userId || typeof payload.userId !== "number") {
      res.status(401).json({ message: "Session expired. Please log in again." });
      return;
    }
    if (payload.tokenType === "2fa_pending") {
      res.status(403).json({ message: "Two-factor authentication required. Please verify your identity." });
      return;
    }
    (req as AuthenticatedRequest).user = payload;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authUser = getAuthUser(req);
  try {
    const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, authUser.userId)).limit(1);
    if (!user || user.role !== "super_admin") {
      res.status(403).json({ message: "Super admin access required" });
      return;
    }
    next();
  } catch {
    res.status(500).json({ message: "Failed to verify admin status" });
  }
}
