import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import { db, medicalDocumentsTable, userProfilesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("No Gemini API key configured.");
    _ai = new GoogleGenAI({ apiKey });
  }
  return _ai;
}

const EXTRACT_PROMPT = `You are a medical document analyst. Extract all medical information from this document image and return a structured JSON object.

Extract as much detail as possible, including:
- patientName, age, gender, bloodGroup
- diagnoses (array of conditions found)
- medications (array of {name, dosage, frequency})
- testResults (object with test name -> result pairs, e.g., bloodSugar, hemoglobin, cholesterol, bloodPressure, pulseRate, oxygenSaturation, bmi)
- allergies (array)
- doctorName, hospitalName
- reportDate (in YYYY-MM-DD format if possible)
- chiefComplaints
- notes (any other relevant medical notes)
- summary (a 2-3 sentence plain-language summary of the document)

Return ONLY valid JSON, no markdown, no explanation. If a field is not found, omit it.`;

const MERGE_PROMPT = `You are a health profile integrator AI. A medical document has been verified as belonging to this user and is more recent than the profile. Intelligently merge the document data into the profile.

Current profile:
PROFILE_JSON

Document extracted data:
DOCUMENT_JSON

Rules:
1. Map document fields to profile fields where obvious (patientName → skip, already in profile; age → only update if document confirms differently; gender → update if specified; bloodGroup → update if found and not already set)
2. medicalConditions: merge with existing (comma-separated, no duplicates, use existing format)
3. medications: update based on document prescriptions if present
4. allergies: merge with existing
5. For health vitals and lab results (bloodPressure, pulseRate, hemoglobin, cholesterol, bloodSugar, bmi, oxygenSaturation, etc.) and clinical info (doctorName, hospitalName, chiefComplaints, notes): add/update these in additionalDetails as key-value pairs
6. Merge new additionalDetails WITH existing — do not remove old keys
7. If document data does not clearly conflict with profile, preserve profile values
8. Only return fields that should actually change

Return ONLY valid JSON with fields to update. The additionalDetails value should be a flat key-value object (not a string). Example:
{
  "bloodGroup": "A+",
  "medicalConditions": "Diabetes (Type 2), Hypertension",
  "additionalDetails": {
    "bloodPressure": "130/85 mmHg",
    "hemoglobin": "12.5 g/dL",
    "lastCheckup": "2024-06-01",
    "doctorName": "Dr. Priya Sharma"
  }
}`;

async function applyDocumentToProfile(
  userId: string,
  extractedData: Record<string, unknown>,
  documentDate: string | null
): Promise<{ updated: boolean; reason: string; changes: string[] }> {
  try {
    const profiles = await db.select().from(userProfilesTable).where(eq(userProfilesTable.clerkUserId, userId));
    if (!profiles.length) return { updated: false, reason: "No profile found", changes: [] };
    const profile = profiles[0];

    const profileTimestamp = profile.updatedAt || profile.createdAt;
    const docDateStr = documentDate || (extractedData.reportDate as string) || null;

    if (docDateStr) {
      const docDate = new Date(docDateStr);
      if (!isNaN(docDate.getTime()) && docDate < profileTimestamp) {
        return {
          updated: false,
          reason: `Document dated ${docDateStr} is older than profile (last updated ${profileTimestamp.toISOString().split("T")[0]}) — profile unchanged`,
          changes: [],
        };
      }
    }

    const existingAdditional: Record<string, unknown> = (() => {
      try { return profile.additionalDetails ? JSON.parse(profile.additionalDetails) : {}; } catch { return {}; }
    })();

    const profileForPrompt = {
      name: profile.name, age: profile.age, gender: profile.gender,
      bloodGroup: profile.bloodGroup, weight: profile.weight, height: profile.height,
      medicalConditions: profile.medicalConditions, medications: profile.medications,
      allergies: profile.allergies, additionalDetails: existingAdditional,
    };

    const prompt = MERGE_PROMPT
      .replace("PROFILE_JSON", JSON.stringify(profileForPrompt, null, 2))
      .replace("DOCUMENT_JSON", JSON.stringify(extractedData, null, 2));

    const response = await getAI().models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 4096 },
    });

    const raw = response.text ?? "{}";
    const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const updates: Record<string, unknown> = JSON.parse(jsonStr);

    if (!updates || Object.keys(updates).length === 0) {
      return { updated: false, reason: "No profile changes needed from this document", changes: [] };
    }

    if (updates.additionalDetails && typeof updates.additionalDetails === "object") {
      const newAdditional = { ...existingAdditional, ...(updates.additionalDetails as Record<string, unknown>) };
      updates.additionalDetails = JSON.stringify(newAdditional);
    }

    const allowedKeys = ["name", "age", "gender", "bloodGroup", "weight", "height",
      "medicalConditions", "medications", "allergies", "sleepHours", "activityLevel",
      "goals", "location", "additionalDetails"];
    const safeUpdates: Record<string, unknown> = {};
    for (const key of allowedKeys) {
      if (key in updates) safeUpdates[key] = updates[key];
    }

    if (Object.keys(safeUpdates).length > 0) {
      await db.update(userProfilesTable).set(safeUpdates as Parameters<typeof db.update>[0]).where(eq(userProfilesTable.clerkUserId, userId));
    }

    return { updated: true, reason: "Profile updated from document", changes: Object.keys(safeUpdates) };
  } catch (err) {
    logger.warn({ err }, "applyDocumentToProfile failed");
    return { updated: false, reason: "Profile merge failed — document saved", changes: [] };
  }
}

router.post("/upload", upload.single("document"), isAuthenticated, async (req: any, res): Promise<void> => {
  const userId = (req as any).user?.claims?.sub;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

  const { mimetype, buffer, originalname } = req.file;
  const supportedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!supportedTypes.includes(mimetype)) {
    res.status(400).json({ error: "Unsupported file type. Please upload a JPEG, PNG, or WebP image." });
    return;
  }

  const belongsToUser = req.body.belongsToUser === "true";

  try {
    const base64 = buffer.toString("base64");

    let extractedData: Record<string, unknown> = {};
    let summary = "";

    try {
      const response = await getAI().models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: EXTRACT_PROMPT },
              { inlineData: { mimeType: mimetype, data: base64 } },
            ],
          },
        ],
        config: { maxOutputTokens: 8192 },
      });

      const raw = response.text ?? "{}";
      const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      extractedData = JSON.parse(jsonStr);
      summary = (extractedData.summary as string) ?? "";
    } catch (aiErr) {
      logger.warn({ aiErr }, "Gemini extraction failed — saving document without data");
      extractedData = {};
      summary = "AI extraction unavailable. Document saved.";
    }

    const documentDate = (extractedData.reportDate as string) ?? null;

    const MEDICAL_FIELDS = ["diagnoses", "medications", "testResults", "bloodGroup", "allergies",
      "doctorName", "chiefComplaints", "patientName", "reportDate", "hemoglobin",
      "bloodPressure", "cholesterol", "bloodSugar", "hospitalName"];
    const meaningfulFields = MEDICAL_FIELDS.filter(f => f in extractedData && extractedData[f]);
    const isRelevantMedicalDoc = meaningfulFields.length >= 2;

    const doc = await db.insert(medicalDocumentsTable).values({
      clerkUserId: userId,
      filename: originalname,
      mimeType: mimetype,
      extractedData: JSON.stringify(extractedData),
      summary,
      belongsToUser,
      documentDate,
    }).returning();

    let profileMerge: { updated: boolean; reason: string; changes: string[] } = { updated: false, reason: "", changes: [] };
    if (belongsToUser && Object.keys(extractedData).length > 0) {
      profileMerge = await applyDocumentToProfile(userId, extractedData, documentDate);
    }

    res.status(201).json({
      ...doc[0],
      extractedData,
      isRelevantMedicalDoc,
      profileUpdated: profileMerge.updated,
      profileUpdateReason: profileMerge.reason,
      profileChanges: profileMerge.changes,
    });
  } catch (err) {
    logger.error({ err }, "Failed to process document");
    res.status(500).json({ error: "Failed to process document" });
  }
});

router.get("/", isAuthenticated, async (req: any, res) => {
  const userId = (req as any).user?.claims?.sub;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const docs = await db.select().from(medicalDocumentsTable)
      .where(eq(medicalDocumentsTable.clerkUserId, userId))
      .orderBy(desc(medicalDocumentsTable.uploadedAt));
    return res.json(docs.map(d => ({
      ...d,
      extractedData: d.extractedData ? JSON.parse(d.extractedData) : null,
    })));
  } catch (err) {
    logger.error({ err }, "Failed to list documents");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", isAuthenticated, async (req: any, res) => {
  const userId = (req as any).user?.claims?.sub;
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
