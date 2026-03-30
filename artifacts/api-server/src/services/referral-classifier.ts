/**
 * Classification rule:
 * - COMPANY if companyName (custom1) OR associatedOfficeId (custom10) OR totalShiftsWorked (custom2) is present/non-empty
 * - PROFESSIONAL otherwise
 */
export function classifyReferralType(fields: {
  companyName?: string | null;
  associatedOfficeId?: string | null;
  totalShiftsWorked?: string | null;
  jobTitle?: string | null;
}): "PROFESSIONAL" | "COMPANY" {
  if (fields.companyName || fields.associatedOfficeId || fields.totalShiftsWorked) {
    return "COMPANY";
  }
  return "PROFESSIONAL";
}
