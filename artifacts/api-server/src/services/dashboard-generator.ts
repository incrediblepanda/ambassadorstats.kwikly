import crypto from "crypto";

export function generateDashboardSlug(shortCode: string): string {
  return `amb-${shortCode.toLowerCase()}`;
}

export function generateDashboardToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function generateIframeUrl(
  baseUrl: string,
  shortCode: string,
  token: string,
): string {
  return `${baseUrl}/dashboard/${shortCode}?token=${token}`;
}
