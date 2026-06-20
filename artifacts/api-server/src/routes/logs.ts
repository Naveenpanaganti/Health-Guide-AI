import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, dailyLogsTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
import { CreateLogBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router = Router();

router.get("/", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateStr = sevenDaysAgo.toISOString().split("T")[0];
    const logs = await db.select().from(dailyLogsTable)
      .where(and(eq(dailyLogsTable.clerkUserId, userId), gte(dailyLogsTable.logDate, dateStr)))
      .orderBy(desc(dailyLogsTable.logDate));
    return res.json(logs);
  } catch (err) {
    logger.error({ err }, "Failed to list logs");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const parsed = CreateLogBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  try {
    const logDate = parsed.data.logDate ?? new Date().toISOString().split("T")[0];
    const log = await db.insert(dailyLogsTable).values({ clerkUserId: userId, ...parsed.data, logDate }).returning();
    return res.status(201).json(log[0]);
  } catch (err) {
    logger.error({ err }, "Failed to create log");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/today", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const today = new Date().toISOString().split("T")[0];
    const logs = await db.select().from(dailyLogsTable)
      .where(and(eq(dailyLogsTable.clerkUserId, userId), eq(dailyLogsTable.logDate, today)));
    if (!logs.length) return res.status(404).json({ error: "No log for today" });
    return res.json(logs[0]);
  } catch (err) {
    logger.error({ err }, "Failed to get today log");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
