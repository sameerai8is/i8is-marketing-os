import "server-only";
import dbConnect from "./mongodb";
import { WorkspaceMember } from "./models/WorkspaceMember";
import { AuditEvent } from "./models/AuditEvent";
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
  if (member?.googleSubject && member.googleSubject !== profile.sub) return false;
  if (member?.status === "blocked") return false;
  const name = typeof profile.name === "string" ? profile.name.slice(0, 200) : "";
  const admitted = maySignIn({ verified: true, companyIdentity: isCompanyIdentity(profile), status: member?.status, inviteExpiresAt: member?.inviteExpiresAt });
  if (!member) {
    // Concurrent first sign-ins converge on the unique tenant/email record.
    try {
      member = await WorkspaceMember.create({ tenantId: WORKSPACE_ID, email, name, role: email === adminEmail && admitted ? "admin" : "member", status: admitted ? "active" : "pending", googleSubject: profile.sub, lastSignInAt: new Date() });
      if (!admitted) await AuditEvent.create({ tenantId: WORKSPACE_ID, actor: email, action: "access.requested", target: email });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      member = await WorkspaceMember.findOne({ tenantId: WORKSPACE_ID, email }).select("+googleSubject");
      if (!member || !["active", "pending"].includes(member.status) || member.googleSubject !== profile.sub) return false;
    }
    return true;
  }
  // A verified identity may hold a restricted session while waiting for approval.
  // Protected APIs still require live active membership on every request.
  if (!admitted) {
    if (member.status === "pending") return true;
    if (member.status === "invited") {
      const result = await WorkspaceMember.updateOne({ _id: member._id, status: "invited", updatedAt: member.updatedAt }, { $set: { status: "pending", googleSubject: profile.sub, name }, $unset: { inviteExpiresAt: 1 } });
      return result.modifiedCount === 1;
    }
    return false;
  }
  const result = await WorkspaceMember.updateOne({ _id: member._id, tenantId: WORKSPACE_ID, status: member.status, updatedAt: member.updatedAt }, {
    $set: { name, status: "active", googleSubject: profile.sub, lastSignInAt: new Date() },
    $unset: { inviteExpiresAt: 1 },
  });
  return result.modifiedCount === 1;
}
