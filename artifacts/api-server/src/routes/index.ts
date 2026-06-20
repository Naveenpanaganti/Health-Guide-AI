import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import plansRouter from "./plans";
import logsRouter from "./logs";
import chatRouter from "./chat";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/users", usersRouter);
router.use("/plans", plansRouter);
router.use("/logs", logsRouter);
router.use("/chat", chatRouter);

export default router;
