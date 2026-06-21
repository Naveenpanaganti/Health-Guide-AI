import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, conversations, messages, userProfilesTable, medicalDocumentsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { CreateConversationBody, SendMessageBody, GetConversationMessagesParams } from "@workspace/api-zod";
import { GoogleGenAI } from "@google/genai";
import { logger } from "../lib/logger";

const router = Router();

let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) {
    const integrationApiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
    const integrationBaseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
    const apiKey = integrationApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("No Gemini API key configured. Please add GEMINI_API_KEY to your secrets.");
    }
    if (integrationApiKey && integrationBaseUrl) {
      _ai = new GoogleGenAI({
        apiKey: integrationApiKey,
        httpOptions: { apiVersion: "", baseUrl: integrationBaseUrl },
      });
    } else {
      _ai = new GoogleGenAI({ apiKey });
    }
  }
  return _ai;
}

const SYSTEM_PROMPTS: Record<string, string> = {
  checkup: `You are VitalGuide AI, a compassionate health assistant. Be concise and direct — 2-4 sentences per response unless detail is truly needed.

Rules:
- Ask 1-2 focused follow-up questions before giving advice; don't bombard the user
- NEVER diagnose — only suggest what to consider
- For emergencies (chest pain, difficulty breathing, severe pain, high fever): immediately say "EMERGENCY" and tell them to call 911/112
- Suggest OTC remedies only for clearly minor issues
- Always end responses with: "This is not medical advice. See a doctor for proper diagnosis."
- Use the user's profile to personalize responses`,

  planner: `You are VitalGuide AI, a personal health coach. Be concise — 2-4 sentences per response.

Rules:
- Help users follow their medication, diet, and fitness plans
- Gently correct deviations without shaming
- Keep a supportive, encouraging tone
- Reference their logged data (food, water, sleep, mood) to personalize advice
- Factor in their medical conditions and goals`,

  education: `You are VitalGuide AI, a health educator. Be concise — answer in 3-5 sentences unless the user asks for more detail.

Rules:
- Give evidence-based information in simple, friendly language
- Bust myths enthusiastically — especially about diet, weight loss, sleep, supplements
- When asked about a food: cover nutrition, health impact, who should avoid it
- Personalize answers to the user's profile when relevant
- Offer to explain more if they want deeper detail`,
};

router.delete("/conversations/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    await db.delete(messages).where(eq(messages.conversationId, id));
    await db.delete(conversations).where(and(eq(conversations.id, id), eq(conversations.clerkUserId, userId)));
    return res.status(204).send();
  } catch (err) {
    logger.error({ err }, "Failed to delete conversation");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/conversations", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const convos = await db.select().from(conversations).where(eq(conversations.clerkUserId, userId));
    return res.json(convos);
  } catch (err) {
    logger.error({ err }, "Failed to list conversations");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/conversations", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const parsed = CreateConversationBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  try {
    const convo = await db.insert(conversations).values({ clerkUserId: userId, ...parsed.data }).returning();
    return res.status(201).json(convo[0]);
  } catch (err) {
    logger.error({ err }, "Failed to create conversation");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/conversations/:id/messages", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const params = GetConversationMessagesParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) return res.status(400).json({ error: "Invalid id" });
  try {
    const msgs = await db.select().from(messages).where(eq(messages.conversationId, params.data.id));
    return res.json(msgs);
  } catch (err) {
    logger.error({ err }, "Failed to get messages");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/conversations/:id/messages", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = GetConversationMessagesParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const convoRows = await db.select().from(conversations).where(and(eq(conversations.id, params.data.id), eq(conversations.clerkUserId, userId)));
    if (!convoRows.length) { res.status(404).json({ error: "Conversation not found" }); return; }
    const convo = convoRows[0];

    await db.insert(messages).values({ conversationId: params.data.id, role: "user", content: parsed.data.content });

    const historyRows = await db.select().from(messages).where(eq(messages.conversationId, params.data.id));

    const profiles = await db.select().from(userProfilesTable).where(eq(userProfilesTable.clerkUserId, userId));
    const profile = profiles[0];

    let systemPrompt = SYSTEM_PROMPTS[convo.mode] ?? SYSTEM_PROMPTS.education;

    if (profile) {
      const additionalDetails: Record<string, unknown> = (() => {
        try { return profile.additionalDetails ? JSON.parse(profile.additionalDetails) : {}; } catch { return {}; }
      })();

      systemPrompt += `\n\n=== USER HEALTH PROFILE ===
Name: ${profile.name} | Age: ${profile.age} | Gender: ${profile.gender ?? "unspecified"}
Blood Group: ${profile.bloodGroup ?? "unknown"} | Weight: ${profile.weight ?? "?"}kg | Height: ${profile.height ?? "?"}cm
Conditions: ${profile.medicalConditions ?? "none"} | Medications: ${profile.medications ?? "none"}
Allergies: ${profile.allergies ?? "none"} | Sleep: ${profile.sleepHours ?? "?"}hrs | Activity: ${profile.activityLevel ?? "unknown"}
Goals: ${profile.goals ?? "none"} | Location: ${profile.location ?? "unknown"}`;

      if (Object.keys(additionalDetails).length > 0) {
        const vitalsText = Object.entries(additionalDetails)
          .filter(([k]) => k !== "summary")
          .map(([k, v]) => {
            const label = k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
            const val = Array.isArray(v) ? (v as unknown[]).join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v);
            return `${label}: ${val}`;
          })
          .join(" | ");
        systemPrompt += `\nVitals/Labs: ${vitalsText}`;
      }
    }

    if (convo.mode === "checkup" && userId) {
      try {
        const recentDocs = await db.select().from(medicalDocumentsTable)
          .where(and(eq(medicalDocumentsTable.clerkUserId, userId), eq(medicalDocumentsTable.belongsToUser, true)))
          .orderBy(desc(medicalDocumentsTable.uploadedAt))
          .limit(3);

        if (recentDocs.length > 0) {
          const docContext = recentDocs.map(d => {
            const date = d.documentDate ?? d.uploadedAt.toISOString().split("T")[0];
            return `- ${d.filename} (${date}): ${d.summary ?? "No summary"}`;
          }).join("\n");
          systemPrompt += `\n\n=== RECENT MEDICAL DOCUMENTS ===\n${docContext}`;
        }
      } catch (docErr) {
        logger.warn({ docErr }, "Failed to fetch documents for checkup context");
      }
    }

    const chatContents = historyRows.slice(-20).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    const stream = await getAI().models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: chatContents,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 2048,
      },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    await db.insert(messages).values({ conversationId: params.data.id, role: "assistant", content: fullResponse });

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err: any) {
    logger.error({ err }, "Failed to send message");

    let userMessage = "Something went wrong. Please try again.";
    const msg: string = err?.message ?? "";

    if (msg.includes("API_KEY_INVALID") || msg.includes("invalid api key") || msg.toLowerCase().includes("api key not valid")) {
      userMessage = "Invalid Gemini API key. Please check your GEMINI_API_KEY secret.";
    } else if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota") || msg.includes("429")) {
      userMessage = "Gemini API quota exceeded. Please check your Google AI billing or wait before retrying.";
    } else if (msg.includes("PERMISSION_DENIED")) {
      userMessage = "Gemini API key does not have permission. Ensure the Gemini API is enabled in your Google Cloud project.";
    } else if (msg.includes("No Gemini API key")) {
      userMessage = "No Gemini API key configured. Please add GEMINI_API_KEY to your secrets.";
    }

    if (!res.headersSent) {
      res.status(500).json({ error: userMessage });
      return;
    }
    res.write(`data: ${JSON.stringify({ error: userMessage })}\n\n`);
    res.end();
  }
});

export default router;
