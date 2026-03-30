import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  adminUsersTable,
  ambassadorsTable,
  referralsTable,
  syncJobsTable,
} from "@workspace/db/schema";
import {
  generateDashboardSlug,
  generateDashboardToken,
  generateIframeUrl,
} from "../../artifacts/api-server/src/services/dashboard-generator";

function getAppBaseUrl(): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL;
  if (process.env.REPLIT_DOMAINS) {
    const domains = process.env.REPLIT_DOMAINS.split(",");
    return `https://${domains[0]}`;
  }
  return "http://localhost";
}

async function seed() {
  console.log("Seeding database...");
  const baseUrl = getAppBaseUrl();

  const email = process.env.ADMIN_BOOTSTRAP_EMAIL || "admin@example.com";
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD || "admin123";
  const passwordHash = await bcrypt.hash(password, 10);

  await db
    .insert(adminUsersTable)
    .values({
      email: email.toLowerCase(),
      passwordHash,
      role: "admin",
      isActive: true,
    })
    .onConflictDoNothing();

  console.log(`Admin user created: ${email}`);

  const ambassadorData = [
    { uid: "amb-001", email: "sarah.johnson@example.com", firstName: "Sarah", lastName: "Johnson", shortCode: "SARAH-J", status: "active", company: "TempStaff Inc" },
    { uid: "amb-002", email: "mike.chen@example.com", firstName: "Mike", lastName: "Chen", shortCode: "MIKE-C", status: "active", company: "DentalPros" },
    { uid: "amb-003", email: "emily.davis@example.com", firstName: "Emily", lastName: "Davis", shortCode: "EMILY-D", status: "active", company: null },
    { uid: "amb-004", email: "james.wilson@example.com", firstName: "James", lastName: "Wilson", shortCode: "JAMES-W", status: "inactive", company: "StaffingSolutions" },
    { uid: "amb-005", email: "lisa.martinez@example.com", firstName: "Lisa", lastName: "Martinez", shortCode: "LISA-M", status: "active", company: "HealthCareHeroes" },
  ];

  for (const amb of ambassadorData) {
    const token = generateDashboardToken();
    const slug = generateDashboardSlug(amb.shortCode);
    const iframeUrl = generateIframeUrl(baseUrl, amb.shortCode, token);

    await db
      .insert(ambassadorsTable)
      .values({
        getAmbassadorUid: amb.uid,
        email: amb.email,
        firstName: amb.firstName,
        lastName: amb.lastName,
        shortCode: amb.shortCode,
        status: amb.status,
        company: amb.company,
        dashboardSlug: slug,
        dashboardToken: token,
        iframeUrl,
        dashboardAccountCreated: true,
        lastSyncedAt: new Date(),
      })
      .onConflictDoNothing();
  }

  console.log("Ambassadors created");

  const ambassadors = await db.select().from(ambassadorsTable);
  const ambMap = new Map(ambassadors.map((a) => [a.shortCode, a.id]));

  const referralData = [
    { ambassadorShortCode: "SARAH-J", sourceType: "PROFESSIONAL", email: "john.temp@example.com", firstName: "John", lastName: "Tempworker", jobTitle: "Dental Hygienist", status: "approved", numberShiftsWorked: 12, approvedAt: new Date("2025-06-15") },
    { ambassadorShortCode: "SARAH-J", sourceType: "PROFESSIONAL", email: "anna.w@example.com", firstName: "Anna", lastName: "Walker", jobTitle: "Dental Assistant", status: "approved", numberShiftsWorked: 8, approvedAt: new Date("2025-07-20") },
    { ambassadorShortCode: "SARAH-J", sourceType: "COMPANY", email: "hr@brightsmile.com", firstName: "Tom", lastName: "Richards", companyName: "BrightSmile Dental", associatedOfficeId: "OFF-101", status: "approved", totalShiftsWorked: 45, approvedAt: new Date("2025-05-10") },
    { ambassadorShortCode: "MIKE-C", sourceType: "PROFESSIONAL", email: "karen.n@example.com", firstName: "Karen", lastName: "Nurse", jobTitle: "Dental Hygienist", status: "pending", numberShiftsWorked: 0 },
    { ambassadorShortCode: "MIKE-C", sourceType: "COMPANY", email: "info@dentalgroup.com", firstName: "Robert", lastName: "Clinic", companyName: "Metro Dental Group", associatedOfficeId: "OFF-202", status: "approved", totalShiftsWorked: 30, approvedAt: new Date("2025-08-01") },
    { ambassadorShortCode: "EMILY-D", sourceType: "PROFESSIONAL", email: "pat.h@example.com", firstName: "Patricia", lastName: "Helper", jobTitle: "Dental Assistant", status: "approved", numberShiftsWorked: 15, approvedAt: new Date("2025-04-12") },
    { ambassadorShortCode: "EMILY-D", sourceType: "PROFESSIONAL", email: "sam.t@example.com", firstName: "Samuel", lastName: "Tech", jobTitle: "Dental Hygienist", status: "pending", numberShiftsWorked: 3 },
    { ambassadorShortCode: "EMILY-D", sourceType: "COMPANY", email: "mgr@smileworks.com", firstName: "Diana", lastName: "Manager", companyName: "SmileWorks Dental", associatedOfficeId: "OFF-303", status: "approved", totalShiftsWorked: 22, approvedAt: new Date("2025-09-05") },
    { ambassadorShortCode: "LISA-M", sourceType: "PROFESSIONAL", email: "alex.p@example.com", firstName: "Alex", lastName: "Pro", jobTitle: "Dental Hygienist", status: "approved", numberShiftsWorked: 20, approvedAt: new Date("2025-03-18") },
    { ambassadorShortCode: "LISA-M", sourceType: "COMPANY", email: "office@healthdent.com", firstName: "Maria", lastName: "Garcia", companyName: "HealthDent Clinic", associatedOfficeId: "OFF-404", status: "approved", totalShiftsWorked: 55, approvedAt: new Date("2025-06-22") },
  ];

  for (const ref of referralData) {
    const ambassadorId = ambMap.get(ref.ambassadorShortCode);
    if (!ambassadorId) continue;

    await db.insert(referralsTable).values({
      ambassadorId,
      sourceType: ref.sourceType,
      email: ref.email,
      firstName: ref.firstName,
      lastName: ref.lastName,
      companyName: ref.companyName || null,
      jobTitle: ref.jobTitle || null,
      associatedOfficeId: ref.associatedOfficeId || null,
      status: ref.status,
      numberShiftsWorked: ref.numberShiftsWorked || null,
      totalShiftsWorked: ref.totalShiftsWorked || null,
      approvedAt: ref.approvedAt || null,
      createdAtSource: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
    });
  }

  console.log("Referrals created");

  await db.insert(syncJobsTable).values({
    jobType: "FULL",
    status: "COMPLETED",
    recordsProcessed: 15,
    recordsFailed: 0,
    startedAt: new Date(Date.now() - 3600000),
    completedAt: new Date(Date.now() - 3500000),
  });

  console.log("Seed sync job created");
  console.log("Seeding complete!");
  console.log(`\nAdmin login: ${email} / ${password}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
