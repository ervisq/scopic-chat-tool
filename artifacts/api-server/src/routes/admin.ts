import { Router, type IRouter } from "express";
import { getUsageLog, getUsageStats, ALL_RANGES, type Range } from "../lib/usage-tracker";
import { getAuthUser, requireAdmin } from "../middlewares/auth";
import { db } from "@workspace/db";
import { users } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { cleanupOrphanedTeamworkCredentials } from "../services/teamworkCredentialCleanup";

const router: IRouter = Router();

router.get("/usage", (req, res) => {
  const raw = String(req.query.range ?? "");
  const range: Range = (ALL_RANGES as string[]).includes(raw) ? (raw as Range) : "today";
  res.json({ range, log: getUsageLog(range), stats: getUsageStats(range) });
});

router.get("/users", async (_req, res) => {
  try {
    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(users.createdAt);

    res.json({ users: allUsers });
  } catch (err) {
    console.error("Failed to fetch users:", err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

router.patch("/users/:id/role", requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(String(req.params.id), 10);
    if (isNaN(userId)) {
      res.status(400).json({ message: "Invalid user ID" });
      return;
    }

    const { role } = req.body;
    if (role !== "user") {
      res.status(400).json({
        message: "Role can only be set to 'user'. The Admin account is fixed and cannot be reassigned.",
      });
      return;
    }

    const authUser = getAuthUser(req);
    if (authUser.userId === userId) {
      res.status(400).json({ message: "You cannot change your own role" });
      return;
    }

    const [targetUser] = await db.select({ id: users.id, email: users.email, role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
    if (!targetUser) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (targetUser.email.toLowerCase() === "ervis.q@scopicsoftware.com") {
      res.status(400).json({ message: "Cannot change the role of the root admin" });
      return;
    }

    const [updated] = await db
      .update(users)
      .set({ role })
      .where(eq(users.id, userId))
      .returning({ id: users.id, name: users.name, email: users.email, role: users.role });

    res.json({ user: updated });
  } catch (err) {
    console.error("Failed to update user role:", err);
    res.status(500).json({ message: "Failed to update user role" });
  }
});

router.post("/maintenance/cleanup-teamwork-credentials", requireAdmin, async (_req, res) => {
  try {
    const removed = await cleanupOrphanedTeamworkCredentials();
    res.json({ removed });
  } catch (err) {
    console.error("Failed to clean up orphaned Teamwork credentials:", err);
    res.status(500).json({ message: "Failed to clean up orphaned Teamwork credentials" });
  }
});

export default router;
