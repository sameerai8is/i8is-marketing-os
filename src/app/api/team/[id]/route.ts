import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { accessErrorResponse, requireMember, requireSameOrigin } from "@/lib/authorization";
import { mayManageMember, normalizeEmail } from "@/lib/access-policy";
import { WorkspaceMember } from "@/lib/models/WorkspaceMember";
import { AuditEvent } from "@/lib/models/AuditEvent";
import { rateLimit } from "@/lib/rate-limit";
import { sendAccessEmail } from "@/lib/access-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    requireSameOrigin(request);
    const actor = await requireMember(true);
    await rateLimit(actor.id, "team-manage");
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Member not found." }, { status: 404, headers });
    const target = await WorkspaceMember.findOne({ _id: id, tenantId: actor.tenantId }).select("+googleSubject");
    if (!target) return NextResponse.json({ error: "Member not found." }, { status: 404, headers });
    if (!mayManageMember(actor.id, target.id, target.email, normalizeEmail(process.env.AUTH_ADMIN_EMAIL) || "")) return NextResponse.json({ error: "You cannot modify your own access or the initial administrator." }, { status: 403, headers });
    const body = await request.json();
    if (body?.action === "approve" && target.status === "pending" && target.googleSubject) target.status = "active";
    else if (body?.action === "block") target.status = "blocked";
    else if (body?.action === "restore") {
      target.status = target.googleSubject ? "active" : "invited";
      if (!target.googleSubject) target.inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    } else if (body?.action === "role" && ["admin", "member"].includes(body?.role)) target.role = body.role;
    else return NextResponse.json({ error: "Invalid member action." }, { status: 400, headers });
    const updated = await WorkspaceMember.findOneAndUpdate({ _id: target._id, tenantId: actor.tenantId, updatedAt: target.updatedAt }, { $set: { status: target.status, role: target.role, ...(target.inviteExpiresAt ? { inviteExpiresAt: target.inviteExpiresAt } : {}) } }, { new: true, runValidators: true });
    if (!updated) return NextResponse.json({ error: "This account changed. Refresh before retrying." }, { status: 409, headers });
    await AuditEvent.create({ tenantId: actor.tenantId, actor: actor.email, action: `member.${body.action}`, target: target.email });
    let emailStatus;
    if (body.action === "approve") {
      emailStatus = await sendAccessEmail(target.email, true, `${target.id}-${updated.updatedAt.getTime()}`);
      await WorkspaceMember.updateOne({ _id: target._id, updatedAt: updated.updatedAt }, { $set: { emailStatus } });
    }
    return NextResponse.json({ emailStatus, message: body.action === "approve" ? `Access approved. ${emailStatus === "accepted" ? "Email accepted by the mail provider." : "They can now refresh their waiting page to enter Orbit."}` : "Member access updated." }, { headers });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request." }, { status: 400, headers });
    return accessErrorResponse(error) || NextResponse.json({ error: "Unable to update member access." }, { status: 503, headers });
  }
}
