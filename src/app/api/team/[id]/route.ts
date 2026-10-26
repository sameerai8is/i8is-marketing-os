import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { accessErrorResponse, requireMember, requireSameOrigin } from "@/lib/authorization";
import { mayManageMember, normalizeEmail } from "@/lib/access-policy";
import { WorkspaceMember } from "@/lib/models/WorkspaceMember";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    requireSameOrigin(request);
    const actor = await requireMember(true);
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Member not found." }, { status: 404, headers });
    const target = await WorkspaceMember.findOne({ _id: id, tenantId: actor.tenantId }).select("+googleSubject");
    if (!target) return NextResponse.json({ error: "Member not found." }, { status: 404, headers });
    if (!mayManageMember(actor.id, target.id, target.email, normalizeEmail(process.env.AUTH_ADMIN_EMAIL) || "")) return NextResponse.json({ error: "You cannot modify your own access or the initial administrator." }, { status: 403, headers });
    const body = await request.json();
    if (body?.action === "block") target.status = "blocked";
    else if (body?.action === "restore") {
      target.status = target.googleSubject ? "active" : "invited";
      if (!target.googleSubject) target.inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    } else if (body?.action === "role" && ["admin", "member"].includes(body?.role)) target.role = body.role;
    else return NextResponse.json({ error: "Invalid member action." }, { status: 400, headers });
    await target.save();
    return NextResponse.json({ message: "Member access updated." }, { headers });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request." }, { status: 400, headers });
    return accessErrorResponse(error) || NextResponse.json({ error: "Unable to update member access." }, { status: 503, headers });
  }
}
