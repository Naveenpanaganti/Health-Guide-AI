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
  sleepAt: text("sleep_at"),
  wokeAt: text("woke_at"),
  bodyCheckMorning: text("body_check_morning"),
  bodyCheckAfternoon: text("body_check_afternoon"),
  bodyCheckEvening: text("body_check_evening"),
  bodyCheckNight: text("body_check_night"),
  waterIntake: real("water_intake"),
  foodLog: text("food_log"),
  foodMorning: text("food_morning"),
  foodAfternoon: text("food_afternoon"),
  foodEvening: text("food_evening"),
  foodNight: text("food_night"),
  junkSugarIntake: text("junk_sugar_intake"),
  symptomsLog: text("symptoms_log"),
  medicationTaken: boolean("medication_taken"),
  notes: text("notes"),
  isCompleted: boolean("is_completed").default(false),
  customSections: text("custom_sections"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDailyLogSchema = createInsertSchema(dailyLogsTable).omit({ id: true, createdAt: true });
export type InsertDailyLog = z.infer<typeof insertDailyLogSchema>;
export type DailyLog = typeof dailyLogsTable.$inferSelect;
