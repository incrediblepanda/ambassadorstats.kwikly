import { pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rawApiPayloadsTable = pgTable("raw_api_payloads", {
  id: serial("id").primaryKey(),
  sourceEndpoint: text("source_endpoint").notNull(),
  sourceRecordId: text("source_record_id"),
  payloadJson: jsonb("payload_json").notNull(),
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRawApiPayloadSchema = createInsertSchema(rawApiPayloadsTable).omit({ id: true, createdAt: true });
export type InsertRawApiPayload = z.infer<typeof insertRawApiPayloadSchema>;
export type RawApiPayload = typeof rawApiPayloadsTable.$inferSelect;
