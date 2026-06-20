import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth";
import { db, plansTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreatePlanBody, UpdatePlanBody, GetPlanParams, UpdatePlanParams, DeletePlanParams } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router = Router();

router.get("/", isAuthenticated, async (req: any, res) => {
  const userId = req.user?.claims?.sub;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const plans = await db.select().from(plansTable).where(eq(plansTable.clerkUserId, userId));
    return res.json(plans);
  } catch (err) {
    logger.error({ err }, "Failed to list plans");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", isAuthenticated, async (req: any, res) => {
  const userId = req.user?.claims?.sub;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const parsed = CreatePlanBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  try {
    const plan = await db.insert(plansTable).values({ clerkUserId: userId, ...parsed.data }).returning();
    return res.status(201).json(plan[0]);
  } catch (err) {
    logger.error({ err }, "Failed to create plan");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", isAuthenticated, async (req: any, res) => {
  const userId = req.user?.claims?.sub;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const params = GetPlanParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) return res.status(400).json({ error: "Invalid id" });
  try {
    const plans = await db.select().from(plansTable).where(and(eq(plansTable.id, params.data.id), eq(plansTable.clerkUserId, userId)));
    if (!plans.length) return res.status(404).json({ error: "Not found" });
    return res.json(plans[0]);
  } catch (err) {
    logger.error({ err }, "Failed to get plan");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", isAuthenticated, async (req: any, res) => {
  const userId = req.user?.claims?.sub;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const params = UpdatePlanParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) return res.status(400).json({ error: "Invalid id" });
  const parsed = UpdatePlanBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  try {
    const updated = await db.update(plansTable).set({ ...parsed.data }).where(and(eq(plansTable.id, params.data.id), eq(plansTable.clerkUserId, userId))).returning();
    if (!updated.length) return res.status(404).json({ error: "Not found" });
    return res.json(updated[0]);
  } catch (err) {
    logger.error({ err }, "Failed to update plan");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", isAuthenticated, async (req: any, res) => {
  const userId = req.user?.claims?.sub;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const params = DeletePlanParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) return res.status(400).json({ error: "Invalid id" });
  try {
    await db.delete(plansTable).where(and(eq(plansTable.id, params.data.id), eq(plansTable.clerkUserId, userId)));
    return res.status(204).send();
  } catch (err) {
    logger.error({ err }, "Failed to delete plan");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
