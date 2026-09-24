import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogRouter from "./catalog";
import adminRouter from "./admin";
import supportRouter from "./support";
import lineAuthRouter from "./line-auth";
import leadsRouter from "./leads";
import customerProfileRouter from "./customer-profile";
import placesRouter from "./places";

const router: IRouter = Router();

router.use(healthRouter);
router.use(catalogRouter);
router.use(adminRouter);
router.use(supportRouter);
router.use(lineAuthRouter);
router.use(leadsRouter);
router.use(customerProfileRouter);
router.use(placesRouter);

export default router;
