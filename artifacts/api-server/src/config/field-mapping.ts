export const CUSTOM_FIELD_MAP = {
  custom1: "companyName",
  custom2: "totalShiftsWorked",
  custom3: "phoneNumber",
  custom4: "approvedAt",
  custom5: "numberShiftsWorked",
  custom6: "jobTitleOrReferralType",
  custom8: "referringShortCode",
  custom9: "fvidOrDashboardId",
  custom10: "associatedOfficeId",
} as const;

export type CustomFieldKey = keyof typeof CUSTOM_FIELD_MAP;

export function mapCustomFields(raw: Record<string, unknown>): Record<string, string | null> {
  const mapped: Record<string, string | null> = {};
  for (const [rawKey, businessKey] of Object.entries(CUSTOM_FIELD_MAP)) {
    const val = raw[rawKey];
    mapped[businessKey] = val != null ? String(val) : null;
  }
  return mapped;
}
