import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth";
import { db, dailyLogsTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
import { CreateLogBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router = Router();

router.get("/", isAuthenticated, async (req: any, res) => {
  const userId = req.user?.claims?.sub;
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

router.get("/today", isAuthenticated, async (req: any, res) => {
  const userId = req.user?.claims?.sub;
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

router.patch("/today", isAuthenticated, async (req: any, res) => {
  const userId = req.user?.claims?.sub;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const today = new Date().toISOString().split("T")[0];
    const existing = await db.select().from(dailyLogsTable)
      .where(and(eq(dailyLogsTable.clerkUserId, userId), eq(dailyLogsTable.logDate, today)));

    const fields = req.body;
    delete fields.id;
    delete fields.clerkUserId;
    delete fields.createdAt;

    if (existing.length) {
      const updated = await db.update(dailyLogsTable)
        .set(fields)
        .where(eq(dailyLogsTable.id, existing[0].id))
        .returning();
      return res.json(updated[0]);
    } else {
      const created = await db.insert(dailyLogsTable)
        .values({ clerkUserId: userId, logDate: today, ...fields })
        .returning();
      return res.status(201).json(created[0]);
    }
  } catch (err) {
    logger.error({ err }, "Failed to upsert today log");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dates", isAuthenticated, async (req: any, res) => {
  const userId = req.user?.claims?.sub;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const days = Number(req.query.days) || 60;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const dateStr = since.toISOString().split("T")[0];
    const logs = await db
      .select({ logDate: dailyLogsTable.logDate, isCompleted: dailyLogsTable.isCompleted })
      .from(dailyLogsTable)
      .where(and(eq(dailyLogsTable.clerkUserId, userId), gte(dailyLogsTable.logDate, dateStr)))
      .orderBy(desc(dailyLogsTable.logDate));
    return res.json(logs);
  } catch (err) {
    logger.error({ err }, "Failed to get log dates");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/date/:date", isAuthenticated, async (req: any, res) => {
  const userId = req.user?.claims?.sub;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { date } = req.params;
    const logs = await db.select().from(dailyLogsTable)
      .where(and(eq(dailyLogsTable.clerkUserId, userId), eq(dailyLogsTable.logDate, date)));
    if (!logs.length) return res.status(404).json({ error: "No log for this date" });
    return res.json(logs[0]);
  } catch (err) {
    logger.error({ err }, "Failed to get log by date");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", isAuthenticated, async (req: any, res) => {
  const userId = req.user?.claims?.sub;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const existing = await db.select().from(dailyLogsTable)
      .where(and(eq(dailyLogsTable.id, id), eq(dailyLogsTable.clerkUserId, userId)));
    if (!existing.length) return res.status(404).json({ error: "Log not found" });

    const fields = req.body;
    delete fields.id;
    delete fields.clerkUserId;
    delete fields.createdAt;

    const updated = await db.update(dailyLogsTable)
      .set(fields)
      .where(eq(dailyLogsTable.id, id))
      .returning();
    return res.json(updated[0]);
  } catch (err) {
    logger.error({ err }, "Failed to update log");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", isAuthenticated, async (req: any, res) => {
  const userId = req.user?.claims?.sub;
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

export default router;
