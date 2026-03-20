import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import chatRouter from "./chat";
import credentialsRouter from "./credentials";
import zohoOAuthRouter from "./zoho-oauth";
import dashboardRouter from "./dashboard";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(zohoOAuthRouter);
router.use(requireAuth, chatRouter);
router.use(requireAuth, credentialsRouter);
router.use(requireAuth, dashboardRouter);

export default router;
