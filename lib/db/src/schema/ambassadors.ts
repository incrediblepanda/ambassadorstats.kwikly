import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ambassadorsTable = pgTable("ambassadors", {
  id: serial("id").primaryKey(),
  getAmbassadorUid: text("get_ambassador_uid").notNull().unique(),
  email: text("email").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  shortCode: text("short_code").unique(),
  status: text("status").notNull().default("active"),
  contactType: text("contact_type").notNull().default("advocate"),
  referrerAmbassadorId: integer("referrer_ambassador_id"),
  referrerEmail: text("referrer_email"),
  uniqueReferrals: integer("unique_referrals").notNull().default(0),
  countClicks: integer("count_clicks").notNull().default(0),
  countShares: integer("count_shares").notNull().default(0),
  totalMoneyEarned: text("total_money_earned").default("0"),
  moneyPaid: text("money_paid").default("0.00"),
  moneyPending: text("money_pending").default("0"),
  balanceMoney: text("balance_money").default("0.00"),
  enrolledAt: timestamp("enrolled_at"),
  company: text("company"),
  jobTitle: text("job_title"),
  approvedAt: timestamp("approved_at"),
  shiftsCount: integer("shifts_count"),
  totalShifts: integer("total_shifts"),
  referringShortCode: text("referring_short_code"),
  referrerName: text("referrer_name"),
  journeyStatus: text("journey_status"),
  dashboardSlug: text("dashboard_slug").notNull().unique(),
  dashboardToken: text("dashboard_token").notNull(),
  iframeUrl: text("iframe_url"),
  dashboardAccountCreated: boolean("dashboard_account_created").notNull().default(true),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAmbassadorSchema = createInsertSchema(ambassadorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAmbassador = z.infer<typeof insertAmbassadorSchema>;
export type Ambassador = typeof ambassadorsTable.$inferSelect;
