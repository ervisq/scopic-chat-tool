import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import keycloakOAuthRouter from "./keycloak-oauth";
import chatRouter from "./chat";
import credentialsRouter from "./credentials";
import zohoOAuthRouter from "./zoho-oauth";
import jiraOAuthRouter from "./jira-oauth";
import teamworkOAuthRouter from "./teamwork-oauth";
import dashboardRouter from "./dashboard";
import objectDetailRouter from "./object-detail";
import toolAccessRouter from "./tool-access";
import accountRouter from "./account";
import adminRouter from "./admin";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(keycloakOAuthRouter);
router.use(zohoOAuthRouter);
router.use(jiraOAuthRouter);
router.use(teamworkOAuthRouter);
router.use(requireAuth, chatRouter);
router.use(requireAuth, credentialsRouter);
router.use(requireAuth, dashboardRouter);
router.use(requireAuth, objectDetailRouter);
router.use(requireAuth, toolAccessRouter);
router.use(requireAuth, accountRouter);
router.use("/admin", requireAuth, requireAdmin, adminRouter);

export default router;
