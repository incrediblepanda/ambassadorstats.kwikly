import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ambassadorsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import {
  GetDashboardDataParams,
  GetDashboardDataQueryParams,
  GetDashboardDataResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/:shortCode", async (req, res) => {
  try {
    const { shortCode } = GetDashboardDataParams.parse(req.params);
    const { token } = GetDashboardDataQueryParams.parse(req.query);

    if (!token) {
      res.status(401).json({ error: "Token required" });
      return;
    }

    const [ambassador] = await db
      .select()
      .from(ambassadorsTable)
      .where(
        and(
          eq(ambassadorsTable.shortCode, shortCode),
          eq(ambassadorsTable.dashboardToken, token),
        ),
      )
      .limit(1);

    if (!ambassador) {
      res.status(401).json({ error: "Invalid short code or token" });
      return;
    }

    const prospects = await db
      .select()
      .from(ambassadorsTable)
      .where(
        and(
          eq(ambassadorsTable.referrerAmbassadorId, ambassador.id),
          eq(ambassadorsTable.contactType, "prospect"),
        ),
      );

    const professionalProspects = prospects.filter((p) => !p.company);
    const companyProspects = prospects.filter((p) => !!p.company);

    const totalReferrals = prospects.length;
    const approvedReferrals = prospects.filter((p) => p.approvedAt != null).length;
    const professionalReferrals = professionalProspects.length;
    const companyReferrals = companyProspects.length;
    const totalProfessionalShiftsWorked = professionalProspects.reduce(
      (sum, p) => sum + (p.shiftsCount ?? 0),
      0,
    );
    const totalCompanyShiftsFilled = companyProspects.reduce(
      (sum, p) => sum + (p.totalShifts ?? 0),
      0,
    );

    const response = GetDashboardDataResponse.parse({
      ambassador: {
        fullName: `${ambassador.firstName} ${ambassador.lastName}`,
        shortCode: ambassador.shortCode,
        status: ambassador.status,
        lastSyncedAt: ambassador.lastSyncedAt?.toISOString() ?? null,
      },
      summary: {
        totalReferrals,
        professionalReferrals,
        companyReferrals,
        approvedReferrals,
        totalProfessionalShiftsWorked,
        totalCompanyShiftsFilled,
      },
      professionalReferrals: professionalProspects.map((p) => ({
        id: p.id,
        ambassadorId: ambassador.id,
        sourceType: "PROFESSIONAL",
        email: p.email,
        firstName: p.firstName,
        lastName: p.lastName,
        companyName: null,
        jobTitle: p.jobTitle ?? null,
        associatedOfficeId: null,
        status: p.status ?? null,
        approvedAt: p.approvedAt?.toISOString() ?? null,
        createdAtSource: p.enrolledAt?.toISOString() ?? p.createdAt.toISOString(),
        numberShiftsWorked: p.shiftsCount ?? null,
        totalShiftsWorked: null,
        createdAt: p.createdAt.toISOString(),
      })),
      companyReferrals: companyProspects.map((p) => ({
        id: p.id,
        ambassadorId: ambassador.id,
        sourceType: "COMPANY",
        email: p.email,
        firstName: p.firstName,
        lastName: p.lastName,
        companyName: p.company ?? null,
        jobTitle: p.jobTitle ?? null,
        associatedOfficeId: null,
        status: p.status ?? null,
        approvedAt: p.approvedAt?.toISOString() ?? null,
        createdAtSource: p.enrolledAt?.toISOString() ?? p.createdAt.toISOString(),
        numberShiftsWorked: null,
        totalShiftsWorked: p.totalShifts ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
    });

    res.json(response);
  } catch (error) {
    req.log.error({ error }, "Dashboard data error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
