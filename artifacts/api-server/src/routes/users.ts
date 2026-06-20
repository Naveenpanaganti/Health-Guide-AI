import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { userProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpsertProfileBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router = Router();

router.get("/profile", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const profiles = await db.select().from(userProfilesTable).where(eq(userProfilesTable.clerkUserId, userId));
    if (!profiles.length) return res.status(404).json({ error: "Profile not found" });
    return res.json(profiles[0]);
  } catch (err) {
    logger.error({ err }, "Failed to get profile");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/profile", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = UpsertProfileBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  try {
    const existing = await db.select().from(userProfilesTable).where(eq(userProfilesTable.clerkUserId, userId));
    if (existing.length) {
      const updated = await db.update(userProfilesTable)
        .set({ ...parsed.data })
        .where(eq(userProfilesTable.clerkUserId, userId))
        .returning();
      return res.json(updated[0]);
    } else {
      const created = await db.insert(userProfilesTable)
        .values({ clerkUserId: userId, ...parsed.data })
        .returning();
      return res.json(created[0]);
    }
  } catch (err) {
    logger.error({ err }, "Failed to upsert profile");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
