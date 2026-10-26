import "server-only";
import dbConnect from "./mongodb";
import { WorkspaceMember } from "./models/WorkspaceMember";
import { isCompanyIdentity, maySignIn, normalizeEmail, WORKSPACE_ID } from "./access-policy";

export async function admitGoogleIdentity(profile: { email?: unknown; email_verified?: unknown; hd?: unknown; sub?: unknown; name?: unknown }): Promise<boolean> {
  const email = normalizeEmail(profile.email);
  if (!email || profile.email_verified !== true || typeof profile.sub !== "string" || !profile.sub) return false;
  // Admin bootstrap must be explicitly configured; there is no first-user-wins rule.
  const adminEmail = normalizeEmail(process.env.AUTH_ADMIN_EMAIL);
  if (!adminEmail || !adminEmail.endsWith("@i8is.com")) return false;
  await dbConnect();
  await WorkspaceMember.init();
  let member = await WorkspaceMember.findOne({ tenantId: WORKSPACE_ID, email }).select("+googleSubject");
  if (!maySignIn({ verified: true, companyIdentity: isCompanyIdentity(profile), status: member?.status, inviteExpiresAt: member?.inviteExpiresAt })) return false;
  if (member?.googleSubject && member.googleSubject !== profile.sub) return false;
  const name = typeof profile.name === "string" ? profile.name.slice(0, 200) : "";
  if (!member) {
    // Concurrent first sign-ins converge on the unique tenant/email record.
    try {
      member = await WorkspaceMember.create({ tenantId: WORKSPACE_ID, email, name, role: email === adminEmail ? "admin" : "member", status: "active", googleSubject: profile.sub, lastSignInAt: new Date() });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      member = await WorkspaceMember.findOne({ tenantId: WORKSPACE_ID, email }).select("+googleSubject");
      if (!member || member.status !== "active" || member.googleSubject !== profile.sub) return false;
    }
    return true;
  }
  const result = await WorkspaceMember.updateOne({ _id: member._id, tenantId: WORKSPACE_ID, status: member.status, updatedAt: member.updatedAt }, {
    $set: { name, status: "active", googleSubject: profile.sub, lastSignInAt: new Date() },
    $unset: { inviteExpiresAt: 1 },
  });
  return result.modifiedCount === 1;
}
