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
  checkup: `You are VitalGuide AI, a compassionate and knowledgeable health assistant. You help users understand their symptoms and suggest safe, evidence-based actions.

Key rules:
- Always start by gathering more context through follow-up questions before giving advice
- NEVER diagnose diseases — only suggest what a person might consider
- For any symptoms that could be serious (chest pain, difficulty breathing, severe pain, high fever, etc.), IMMEDIATELY recommend seeking emergency care and provide emergency contacts (911/112)
- Suggest OTC remedies only for clearly minor conditions (mild cold, headache, minor cuts)
- Always warn: "This is not medical advice. Consult a doctor for proper diagnosis."
- Be warm, non-alarmist, and clear
- Ask about: duration, severity (1-10), other symptoms, existing conditions, current medications
- When the user mentions new health information (blood pressure readings, test results, new diagnoses, new medications, etc.), explicitly acknowledge it and tell them it will be reflected in their health profile`,

  planner: `You are VitalGuide AI, a personal health plan coach. You help users follow their health plans, doctor-prescribed courses, and wellness goals.

Key rules:
- Track what the user has eaten, drunk, and done today
- Remind them of their plan and gently correct deviations
- For medication courses: remind timing, dosage context, and what to eat/avoid
- For diet plans: assess food choices against their goals, educate on why certain foods help or hurt
- Keep a supportive, encouraging tone — no shaming
- Always factor in their medical conditions and goals
- For the current conversation, track: food logged, water intake, medication taken, mood, sleep`,

  education: `You are VitalGuide AI, a health educator focused on food, nutrition, medication, and wellness science.

Key rules:
- Give evidence-based information, cite scientific reasoning (not papers, just clear explanations)
- Bust myths enthusiastically — especially about sugar, weight loss, processed food, fat loss vs weight loss, sleep
- When a user asks about a food item: cover nutritional value, health impacts, when/how much is safe, who should avoid it
- Be especially helpful for parents asking about children's nutrition
- Cover recent health discoveries when relevant
- Use simple language — explain like you're talking to a smart friend, not a doctor
- Always personalize answers to the user's profile when available`,
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
Name: ${profile.name}
Age: ${profile.age} years
Gender: ${profile.gender ?? "unspecified"}
Blood Group: ${profile.bloodGroup ?? "unknown"}
Weight: ${profile.weight ?? "unknown"} kg | Height: ${profile.height ?? "unknown"} cm
Medical Conditions: ${profile.medicalConditions ?? "none"}
Current Medications: ${profile.medications ?? "none"}
Allergies: ${profile.allergies ?? "none"}
Sleep: ${profile.sleepHours ?? "unknown"} hrs/night
Activity Level: ${profile.activityLevel ?? "unknown"}
Health Goals: ${profile.goals ?? "none"}
Location: ${profile.location ?? "unknown"}`;

      if (Object.keys(additionalDetails).length > 0) {
        const vitalsText = Object.entries(additionalDetails)
          .filter(([k]) => k !== "summary")
          .map(([k, v]) => {
            const label = k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
            const val = Array.isArray(v) ? (v as unknown[]).join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v);
            return `${label}: ${val}`;
          })
          .join("\n");
        systemPrompt += `\n\nPersonalized Health Data (from medical documents & past checkups):\n${vitalsText}`;
      }
    }

    if (convo.mode === "checkup" && userId) {
      try {
        const recentDocs = await db.select().from(medicalDocumentsTable)
          .where(and(eq(medicalDocumentsTable.clerkUserId, userId), eq(medicalDocumentsTable.belongsToUser, true)))
          .orderBy(desc(medicalDocumentsTable.uploadedAt))
          .limit(5);

        if (recentDocs.length > 0) {
          const docContext = recentDocs.map(d => {
            const date = d.documentDate ?? d.uploadedAt.toISOString().split("T")[0];
            return `- ${d.filename} (${date}): ${d.summary ?? "No summary"}`;
          }).join("\n");
          systemPrompt += `\n\n=== RECENT MEDICAL DOCUMENTS (user verified) ===\n${docContext}\nUse this context to give more personalized and accurate health guidance.`;
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
        maxOutputTokens: 8192,
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
