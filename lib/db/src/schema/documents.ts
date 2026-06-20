import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";

export const medicalDocumentsTable = pgTable("medical_documents", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  extractedData: text("extracted_data"),
  summary: text("summary"),
  belongsToUser: boolean("belongs_to_user"),
  documentDate: text("document_date"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MedicalDocument = typeof medicalDocumentsTable.$inferSelect;
