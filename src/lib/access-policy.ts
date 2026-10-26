export const WORKSPACE_ID = "i8is";
export const COMPANY_DOMAIN = "i8is.com";

export function isSameOrigin(origin: string | null, host: string | null, protocol: string): boolean {
  if (!origin || !host || !["http", "https"].includes(protocol) || /[\s/@?#\\]/.test(host)) return false;
  try { return new URL(`${protocol}://${host}`).origin === origin; }
  catch { return false; }
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(email) && email.length <= 254 ? email : null;
}

export function isCompanyIdentity(profile: { email?: unknown; email_verified?: unknown; hd?: unknown }): boolean {
  const email = normalizeEmail(profile.email);
  return profile.email_verified === true && email?.split("@")[1] === COMPANY_DOMAIN && profile.hd === COMPANY_DOMAIN;
}

export function maySignIn(input: { verified: boolean; companyIdentity: boolean; status?: string; inviteExpiresAt?: Date | null; now?: Date }): boolean {
  if (!input.verified || input.status === "blocked") return false;
  if (input.status === "active") return true;
  if (input.status === "invited") return Boolean(input.inviteExpiresAt && input.inviteExpiresAt > (input.now || new Date()));
  return !input.status && input.companyIdentity;
}

export function mayManageMember(actorId: string, targetId: string, targetEmail: string, bootstrapEmail: string): boolean {
  return actorId !== targetId && targetEmail !== bootstrapEmail;
}
