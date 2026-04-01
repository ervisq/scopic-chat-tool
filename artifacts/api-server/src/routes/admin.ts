import { Router, type IRouter } from "express";
import { getUsageLog, getUsageStats } from "../lib/usage-tracker";
import { getAuthUser, requireSuperAdmin } from "../middlewares/auth";
import { db } from "@workspace/db";
import { users } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/usage", (_req, res) => {
  res.json({ log: getUsageLog(), stats: getUsageStats() });
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

router.patch("/users/:id/role", requireSuperAdmin, async (req, res) => {
  try {
    const userId = parseInt(String(req.params.id), 10);
    if (isNaN(userId)) {
      res.status(400).json({ message: "Invalid user ID" });
      return;
    }

    const { role } = req.body;
    if (!role || !["admin", "user"].includes(role)) {
      res.status(400).json({ message: "Role must be 'admin' or 'user'" });
      return;
    }

    const authUser = getAuthUser(req);
    if (authUser.userId === userId) {
      res.status(400).json({ message: "You cannot change your own role" });
      return;
    }

    const [targetUser] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
    if (!targetUser) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (targetUser.role === "super_admin") {
      res.status(400).json({ message: "Cannot change the role of a super admin" });
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

export default router;
