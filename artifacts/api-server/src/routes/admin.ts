import { db } from "@workspace/db";
import { createAdminRouter } from "./admin-router";

export { createAdminRouter };

export default createAdminRouter(db);