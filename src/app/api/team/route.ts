import { NextResponse } from "next/server";
import { accessErrorResponse, requireMember, requireSameOrigin } from "@/lib/authorization";
import { normalizeEmail } from "@/lib/access-policy";
import { WorkspaceMember } from "@/lib/models/WorkspaceMember";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    const actor = await requireMember(true);
    const members = await WorkspaceMember.find({ tenantId: actor.tenantId }).sort({ createdAt: 1 }).limit(500);
    return NextResponse.json({ actorId: actor.id, members: members.map(member => ({ id: member.id, email: member.email, name: member.name, role: member.role, status: member.status, inviteExpiresAt: member.inviteExpiresAt, lastSignInAt: member.lastSignInAt, protected: member.email === normalizeEmail(process.env.AUTH_ADMIN_EMAIL) })) }, { headers });
  } catch (error) {
    return accessErrorResponse(error) || NextResponse.json({ error: "Unable to load team members." }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const actor = await requireMember(true);
    const body = await request.json();
    const email = normalizeEmail(body?.email);
    const role = body?.role;
    if (!email || !["admin", "member"].includes(role)) return NextResponse.json({ error: "Provide a valid email and role." }, { status: 400, headers });
    await WorkspaceMember.init();
    const existing = await WorkspaceMember.findOne({ tenantId: actor.tenantId, email });
    if (existing && existing.status !== "invited") return NextResponse.json({ error: "This account already exists. Use the member controls to change its access." }, { status: 409, headers });
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await WorkspaceMember.findOneAndUpdate({ tenantId: actor.tenantId, email, status: "invited" }, { $set: { role, inviteExpiresAt: expires, invitedBy: actor.email }, $setOnInsert: { name: "" } }, { upsert: true, runValidators: true });
    return NextResponse.json({ message: "Access approved for 7 days. Share the app's login link with this person; no email was sent." }, { status: 201, headers });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request." }, { status: 400, headers });
    if ((error as { code?: number }).code === 11000) return NextResponse.json({ error: "This account was updated concurrently. Refresh and try again." }, { status: 409, headers });
    return accessErrorResponse(error) || NextResponse.json({ error: "Unable to approve this account." }, { status: 503, headers });
  }
}
