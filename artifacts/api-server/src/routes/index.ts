import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogRouter from "./catalog";
import adminRouter from "./admin";
import supportRouter from "./support";
import lineAuthRouter from "./line-auth";
import leadsRouter from "./leads";
import customerProfileRouter from "./customer-profile";
import placesRouter from "./places";
import portfolioRouter from "./portfolio";
import studioDraftRouter from "./studio-draft";
import stoneMatchRouter from "./stone-match";

const router: IRouter = Router();

router.use(healthRouter);
router.use(catalogRouter);
// ใบงาน 266: POST /api/admin/stone-match — ต้องอยู่ก่อน adminRouter เพื่อไม่ให้ createAdminRouter
// ที่ mount middleware บนทุกเส้นทาง /admin/* มาดักคำข้อนี้ไว้ก่อน (path นี้ไม่มีใน admin-router)
router.use(stoneMatchRouter);
router.use(adminRouter);
router.use(supportRouter);
router.use(lineAuthRouter);
router.use(leadsRouter);
router.use(customerProfileRouter);
router.use(placesRouter);
router.use(portfolioRouter);
router.use(studioDraftRouter);

export default router;
