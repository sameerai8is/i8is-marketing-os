import { NextResponse } from "next/server";
import { accessErrorResponse, requireMember, requireSameOrigin } from "@/lib/authorization";
import { normalizeEmail } from "@/lib/access-policy";
import { WorkspaceMember } from "@/lib/models/WorkspaceMember";
import { AuditEvent } from "@/lib/models/AuditEvent";
import { appUrl, sendAccessEmail } from "@/lib/access-email";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  try {
    const actor = await requireMember(true);
    const url = new URL(request.url);
    const page = Math.max(1, Math.min(10000, Math.floor(Number(url.searchParams.get("page")) || 1)));
    const q = (url.searchParams.get("q") || "").trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const status = url.searchParams.get("status");
    const filter = { tenantId: actor.tenantId, ...(q ? { email: { $regex: q, $options: "i" } } : {}), ...(["pending", "invited", "active", "blocked"].includes(status || "") ? { status } : {}) };
    const [members, total, pendingCount, events] = await Promise.all([
      WorkspaceMember.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 50).limit(50), WorkspaceMember.countDocuments(filter),
      WorkspaceMember.countDocuments({ tenantId: actor.tenantId, status: "pending" }),
      AuditEvent.find({ tenantId: actor.tenantId }).sort({ createdAt: -1 }).limit(15).select("actor action target createdAt -_id").lean(),
    ]);
    return NextResponse.json({ actorId: actor.id, page, total, pages: Math.max(1, Math.ceil(total / 50)), pendingCount, events, loginUrl: `${appUrl()}/login`, emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.INVITE_FROM_EMAIL), members: members.map(m => ({ id: m.id, email: m.email, name: m.name, role: m.role, status: m.status, emailStatus: m.emailStatus, inviteExpiresAt: m.inviteExpiresAt, lastSignInAt: m.lastSignInAt, protected: m.email === normalizeEmail(process.env.AUTH_ADMIN_EMAIL) })) }, { headers });
  } catch (error) { return accessErrorResponse(error) || NextResponse.json({ error: "Unable to load team members." }, { status: 503, headers }); }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const actor = await requireMember(true);
    await rateLimit(actor.id, "team-invite", 10);
    const body = await request.json();
    const email = normalizeEmail(body?.email);
    const role = body?.role;
    if (!email || !["admin", "member"].includes(role)) return NextResponse.json({ error: "Provide a valid email and role." }, { status: 400, headers });
    await WorkspaceMember.init();
    const existing = await WorkspaceMember.findOne({ tenantId: actor.tenantId, email });
    if (existing && existing.status !== "invited") return NextResponse.json({ error: "This account already exists. Use its Approve, Restore, or role controls below." }, { status: 409, headers });
    const member = await WorkspaceMember.findOneAndUpdate({ tenantId: actor.tenantId, email, status: "invited" }, { $set: { role, inviteExpiresAt: new Date(Date.now() + 7 * 86400000), invitedBy: actor.email }, $setOnInsert: { name: "" } }, { upsert: true, runValidators: true, new: true });
    await AuditEvent.create({ tenantId: actor.tenantId, actor: actor.email, action: existing ? "invitation.resent" : "invitation.created", target: email });
    const emailStatus = await sendAccessEmail(email, false, `${member!.id}-${member!.updatedAt.getTime()}`);
    await WorkspaceMember.updateOne({ _id: member!._id, updatedAt: member!.updatedAt }, { $set: { emailStatus } });
    return NextResponse.json({ emailStatus, loginUrl: `${appUrl()}/login`, message: emailStatus === "accepted" ? "Invitation saved; email accepted by the mail provider. Access expires in 7 days until they join." : emailStatus === "failed" ? "Invitation saved, but email could not be sent. Copy the login link or retry the invitation." : "Invitation saved for 7 days. Copy the login link and share it; email delivery is not configured." }, { status: 201, headers });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request." }, { status: 400, headers });
    if ((error as { code?: number }).code === 11000) return NextResponse.json({ error: "This account changed concurrently. Refresh and try again." }, { status: 409, headers });
    return accessErrorResponse(error) || NextResponse.json({ error: "Unable to invite this account." }, { status: 503, headers });
  }
}
