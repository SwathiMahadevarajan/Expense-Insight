import { Router, type IRouter } from "express";
import healthRouter from "./health";
import transactionsRouter from "./transactions";
import categoriesRouter from "./categories";
import accountsRouter from "./accounts";
import insightsRouter from "./insights";
import notificationsRouter from "./notifications";
import emailImportRouter from "./email-import";

const router: IRouter = Router();

router.use(healthRouter);
router.use(transactionsRouter);
router.use(categoriesRouter);
router.use(accountsRouter);
router.use(insightsRouter);
router.use(notificationsRouter);
router.use(emailImportRouter);

export default router;
