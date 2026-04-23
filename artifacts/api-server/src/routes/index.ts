import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import chatRouter from "./chat";
import credentialsRouter from "./credentials";
import zohoOAuthRouter from "./zoho-oauth";
import jiraOAuthRouter from "./jira-oauth";
import dashboardRouter from "./dashboard";
import accountRouter from "./account";
import adminRouter from "./admin";
import { requireAuth, requireSuperAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(zohoOAuthRouter);
router.use(jiraOAuthRouter);
router.use(requireAuth, chatRouter);
router.use(requireAuth, credentialsRouter);
router.use(requireAuth, dashboardRouter);
router.use(requireAuth, accountRouter);
router.use("/admin", requireAuth, requireSuperAdmin, adminRouter);

export default router;
