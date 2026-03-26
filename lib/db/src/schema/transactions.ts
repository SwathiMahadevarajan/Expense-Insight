import { pgTable, text, timestamp, uuid, doublePrecision, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { categoriesTable } from "./categories";
import { accountsTable } from "./accounts";
import { usersTable } from "./auth";

export const transactionsTable = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  amount: doublePrecision("amount").notNull(),
  type: text("type", {
    enum: ["income", "expense"],
  }).notNull().default("expense"),
  description: text("description").notNull(),
  merchantName: text("merchant_name"),
  date: timestamp("date", { withTimezone: true }).notNull(),
  categoryId: uuid("category_id").references(() => categoriesTable.id, { onDelete: "set null" }),
  accountId: uuid("account_id").references(() => accountsTable.id, { onDelete: "set null" }),
  notes: text("notes"),
  importSource: text("import_source", {
    enum: ["manual", "email"],
  }).default("manual"),
  gmailMessageId: text("gmail_message_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
