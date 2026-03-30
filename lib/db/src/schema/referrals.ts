import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { ambassadorsTable } from "./ambassadors";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  ambassadorId: integer("ambassador_id").notNull().references(() => ambassadorsTable.id),
  sourceType: text("source_type").notNull(),
  sourceRecordId: text("source_record_id"),
  campaignUid: text("campaign_uid"),
  orderId: text("order_id"),
  transactionUid: text("transaction_uid"),
  email: text("email"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  companyName: text("company_name"),
  jobTitle: text("job_title"),
  associatedOfficeId: text("associated_office_id"),
  approvedAt: timestamp("approved_at"),
  createdAtSource: timestamp("created_at_source"),
  status: text("status"),
  numberShiftsWorked: integer("number_shifts_worked"),
  totalShiftsWorked: integer("total_shifts_worked"),
  rawCustom1: text("raw_custom_1"),
  rawCustom2: text("raw_custom_2"),
  rawCustom3: text("raw_custom_3"),
  rawCustom4: text("raw_custom_4"),
  rawCustom5: text("raw_custom_5"),
  rawCustom6: text("raw_custom_6"),
  rawCustom7: text("raw_custom_7"),
  rawCustom8: text("raw_custom_8"),
  rawCustom9: text("raw_custom_9"),
  rawCustom10: text("raw_custom_10"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertReferralSchema = createInsertSchema(referralsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = typeof referralsTable.$inferSelect;
