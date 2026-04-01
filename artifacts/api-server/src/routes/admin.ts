import { Router, type IRouter } from "express";
import { getUsageLog, getUsageStats } from "../lib/usage-tracker";

const router: IRouter = Router();

router.get("/usage", (_req, res) => {
  res.json({ log: getUsageLog(), stats: getUsageStats() });
});

export default router;
