import { pgTable, text, boolean, timestamp, uuid, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const notificationsTable = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type", {
    enum: ["daily_review", "weekly_summary", "bill_reminder", "budget_alert", "custom"],
  }).notNull().default("custom"),
  frequency: text("frequency", {
    enum: ["daily", "weekly", "monthly", "once"],
  }).notNull().default("daily"),
  time: text("time").notNull().default("09:00"),
  dayOfWeek: integer("day_of_week"),
  dayOfMonth: integer("day_of_month"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type NotificationSetting = typeof notificationsTable.$inferSelect;
