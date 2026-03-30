import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import ambassadorsRouter from "./ambassadors";
import syncRouter from "./sync";
import settingsRouter from "./settings";
import dashboardRouter from "./dashboard";
import webhooksRouter from "./webhooks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(ambassadorsRouter);
router.use(syncRouter);
router.use(settingsRouter);
router.use(dashboardRouter);
router.use(webhooksRouter);

export default router;
