import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === "development" ? "dev-secret-change-in-production" : "");

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required in production");
}

export interface AuthPayload {
  userId: number;
  email: string;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthPayload;
}

export function getAuthUser(req: Request): AuthPayload {
  return (req as AuthenticatedRequest).user;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload;
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
    (req as AuthenticatedRequest).user = payload;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}
