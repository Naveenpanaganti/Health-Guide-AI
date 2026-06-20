import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth";
import { db, dailyLogsTable, userProfilesTable, plansTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
import { CreateLogBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { GoogleGenAI } from "@google/genai";

let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) {
    const integrationApiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
    const integrationBaseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
    const apiKey = integrationApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error("No Gemini API key configured.");
    if (integrationApiKey && integrationBaseUrl) {
      _ai = new GoogleGenAI({ apiKey: integrationApiKey, httpOptions: { apiVersion: "", baseUrl: integrationBaseUrl } });
    } else {
      _ai = new GoogleGenAI({ apiKey });
    }
  }
  return _ai;
}

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

router.post("/analyze", isAuthenticated, async (req: any, res) => {
  const userId = req.user?.claims?.sub;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { log, isCompleted } = req.body;
  if (!log) return res.status(400).json({ error: "Log data required" });

  try {
    const [profiles, plans] = await Promise.all([
      db.select().from(userProfilesTable).where(eq(userProfilesTable.clerkUserId, userId)),
      db.select().from(plansTable).where(eq(plansTable.clerkUserId, userId)),
    ]);

    const profile = profiles[0];
    const activePlans = plans.filter((p: any) => p.status === "active");

    const profileCtx = profile
      ? `User: ${profile.name}, Age: ${profile.age}, Goals: ${profile.goals ?? "general health"}, Conditions: ${profile.medicalConditions ?? "none"}, Medications: ${profile.medications ?? "none"}`
      : "";

    const plansCtx = activePlans.length
      ? activePlans.map((p: any) => `${p.type} — "${p.title}"${p.description ? `: ${p.description}` : ""}`).join("; ")
      : "No active plans";

    const logParts: string[] = [];
    if (log.mood) logParts.push(`Mood: ${log.mood}`);
    if (log.sleepHours) logParts.push(`Sleep: ${log.sleepHours}h`);
    if (log.sleepAt && log.wokeAt) logParts.push(`Slept ${log.sleepAt} – Woke ${log.wokeAt}`);
    if (log.waterIntake) logParts.push(`Water: ${log.waterIntake} glasses`);
    const meals = [log.foodMorning, log.foodAfternoon, log.foodEvening, log.foodNight].filter(Boolean);
    if (meals.length) logParts.push(`Meals: ${meals.join(", ")}`);
    if (log.junkSugarIntake) logParts.push(`Junk/sugar: ${log.junkSugarIntake}`);
    if (log.bodyCheckMorning) logParts.push(`Morning feel: ${log.bodyCheckMorning}`);
    if (log.bodyCheckEvening) logParts.push(`Evening feel: ${log.bodyCheckEvening}`);
    if (log.notes) logParts.push(`Notes: ${log.notes}`);
    const logCtx = logParts.length ? logParts.join(". ") : "Log is mostly empty so far.";

    let prompt: string;

    if (isCompleted) {
      prompt = `You are VitalGuide AI, a warm and encouraging personal health coach.

The user just completed their daily health log for today. Celebrate and motivate them.

${profileCtx ? `Profile: ${profileCtx}` : ""}
Active plans: ${plansCtx}
Today's log: ${logCtx}

Write a short end-of-day summary (3–4 sentences max):
1. Celebrate 1–2 things that went well today (specific to their log).
2. Mention one small thing to work on tomorrow.
3. Give one concrete tip to prepare for a better tomorrow.
Be warm, personal, and uplifting. No bullet points — conversational tone. No medical disclaimers.`;
    } else {
      const hour = new Date().getHours();
      const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
      const hoursLeft = Math.max(1, 23 - hour);
      prompt = `You are VitalGuide AI, a caring personal health coach.

The user saved a draft of their daily log. It's ${timeOfDay} (about ${hoursLeft} hours left in the day).

${profileCtx ? `Profile: ${profileCtx}` : ""}
Active plans: ${plansCtx}
So far today: ${logCtx}

Give 2–3 specific, friendly reminders or precautions for the rest of today based on their log and plans. 
Focus on what's missing or needs attention (e.g. low water, skipped meals, medication reminder, workout, sleep time).
Keep it to 3–4 sentences total. Conversational, no bullet points. End with one short encouraging line.`;
    }

    const ai = getAI();
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 220, temperature: 0.85 },
    });

    const message = result.text?.trim() ?? "Keep up the great work today!";
    return res.json({ message, type: isCompleted ? "endofday" : "midday" });
  } catch (err: any) {
    logger.error({ err }, "Failed to analyze log");
    return res.status(500).json({ error: "Analysis failed" });
  }
});

export default router;
