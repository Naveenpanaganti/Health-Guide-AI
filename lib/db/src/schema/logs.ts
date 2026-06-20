import { pgTable, text, serial, timestamp, integer, real, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dailyLogsTable = pgTable("daily_logs", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  planId: integer("plan_id"),
  logDate: date("log_date", { mode: "string" }).notNull(),
  mood: text("mood"),
  sleepHours: real("sleep_hours"),
  waterIntake: real("water_intake"),
  foodLog: text("food_log"),
  symptomsLog: text("symptoms_log"),
  medicationTaken: boolean("medication_taken"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDailyLogSchema = createInsertSchema(dailyLogsTable).omit({ id: true, createdAt: true });
export type InsertDailyLog = z.infer<typeof insertDailyLogSchema>;
export type DailyLog = typeof dailyLogsTable.$inferSelect;
