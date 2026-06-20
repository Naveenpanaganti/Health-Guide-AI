import { Router } from "express";
import { getAuth } from "@clerk/express";
import multer from "multer";
import OpenAI from "openai";
import { db, medicalDocumentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const EXTRACT_PROMPT = `You are a medical document analyst. Extract all medical information from this document image and return a structured JSON object.

Extract as much detail as possible, including:
- patientName, age, gender, bloodGroup
- diagnoses (array of conditions found)
- medications (array of {name, dosage, frequency})
- testResults (object with test name -> result pairs, e.g., bloodSugar, hemoglobin, cholesterol)
- allergies (array)
- doctorName, hospitalName
- reportDate
- chiefComplaints
- notes (any other relevant medical notes)
- summary (a 2-3 sentence plain-language summary of the document)

Return ONLY valid JSON, no markdown, no explanation. If a field is not found, omit it.`;

router.post("/upload", upload.single("document"), async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

  const { mimetype, buffer, originalname } = req.file;
  const supportedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!supportedTypes.includes(mimetype)) {
    res.status(400).json({ error: "Unsupported file type. Please upload a JPEG, PNG, or WebP image." });
    return;
  }

  try {
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${mimetype};base64,${base64}`;

    let extractedData: Record<string, unknown> = {};
    let summary = "";

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: EXTRACT_PROMPT },
              { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
            ],
          },
        ],
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      extractedData = JSON.parse(raw);
      summary = (extractedData.summary as string) ?? "";
    } catch (aiErr) {
      logger.warn({ aiErr }, "OpenAI extraction failed — saving document without data");
      extractedData = {};
      summary = "AI extraction unavailable. Document saved.";
    }

    const doc = await db.insert(medicalDocumentsTable).values({
      clerkUserId: userId,
      filename: originalname,
      mimeType: mimetype,
      extractedData: JSON.stringify(extractedData),
      summary,
    }).returning();

    res.status(201).json(doc[0]);
  } catch (err) {
    logger.error({ err }, "Failed to process document");
    res.status(500).json({ error: "Failed to process document" });
  }
});

router.get("/", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const docs = await db.select().from(medicalDocumentsTable).where(eq(medicalDocumentsTable.clerkUserId, userId));
    return res.json(docs.map(d => ({
      ...d,
      extractedData: d.extractedData ? JSON.parse(d.extractedData) : null,
    })));
  } catch (err) {
    logger.error({ err }, "Failed to list documents");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const id = Number(req.params.id);
  try {
    await db.delete(medicalDocumentsTable).where(and(eq(medicalDocumentsTable.id, id), eq(medicalDocumentsTable.clerkUserId, userId)));
    return res.status(204).send();
  } catch (err) {
    logger.error({ err }, "Failed to delete document");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
