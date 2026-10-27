import { NextResponse } from "next/server";
import { accessErrorResponse, requireMember, requireSameOrigin } from "@/lib/authorization";
import { WorkspaceSettings } from "@/lib/models/WorkspaceSettings";
import { AuditEvent } from "@/lib/models/AuditEvent";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  try {
    const actor = await requireMember();
    const settings = await WorkspaceSettings.findOne({ tenantId: actor.tenantId }).lean();
    return NextResponse.json({ settings: settings || { companyName: "I8IS", audience: "", tone: "Professional and clear", marketingGoal: "", autonomy: "assisted", facts: [] }, admin: actor.role === "admin", capabilities: { research: Boolean(process.env.OPENAI_API_KEY), textGeneration: Boolean(process.env.OPENAI_API_KEY) } }, { headers });
  } catch (e) { return accessErrorResponse(e) || NextResponse.json({ error: "Workspace settings could not be loaded." }, { status: 503, headers }); }
}
export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const actor = await requireMember();
    await rateLimit(actor.id, "workspace-update");
    const body = await request.json();
    let values: Record<string, unknown>;
    if (body?.action === "goal" && typeof body.marketingGoal === "string" && body.marketingGoal.trim().length <= 1000) {
      values = { marketingGoal: body.marketingGoal.trim() };
    } else {
      if (actor.role !== "admin") return NextResponse.json({ error: "Only administrators can change company knowledge or autonomy." }, { status: 403, headers });
      if (body?.action === "autonomy" && ["assisted", "managed"].includes(body.autonomy)) values = { autonomy: body.autonomy };
      else if (body?.action === "knowledge") {
        if (typeof body.companyName !== "string" || !body.companyName.trim() || body.companyName.length > 200 || typeof body.audience !== "string" || body.audience.length > 2000 || typeof body.tone !== "string" || body.tone.length > 1000 || !Array.isArray(body.facts) || body.facts.length > 50) return NextResponse.json({ error: "Check the company profile fields." }, { status: 400, headers });
        const facts = [];
        for (const f of body.facts) {
          if (!f || typeof f.text !== "string" || !f.text.trim() || f.text.length > 1000 || typeof f.source !== "string" || !f.source.trim() || f.source.length > 1000) return NextResponse.json({ error: "Each verified fact needs a claim and a source/reference, up to 1,000 characters each." }, { status: 400, headers });
          facts.push({ text: f.text.trim(), source: f.source.trim(), verifiedBy: actor.email, verifiedAt: new Date() });
        }
        if (facts.length && body.confirmVerified !== true) return NextResponse.json({ error: "Confirm that you reviewed the claims and their sources." }, { status: 400, headers });
        values = { companyName: body.companyName.trim(), audience: body.audience.trim(), tone: body.tone.trim(), facts };
      } else return NextResponse.json({ error: "Invalid workspace action." }, { status: 400, headers });
    }
    const current = await WorkspaceSettings.findOne({ tenantId: actor.tenantId });
    if ((current?.updatedAt.toISOString() || null) !== (body.updatedAt || null)) return NextResponse.json({ error: "Workspace settings changed. Refresh before saving." }, { status: 409, headers });
    const settings = await WorkspaceSettings.findOneAndUpdate({ tenantId: actor.tenantId, ...(current ? { updatedAt: current.updatedAt } : { updatedAt: { $exists: false } }) }, { $set: values, $setOnInsert: { tenantId: actor.tenantId } }, { new: true, upsert: !current, runValidators: true });
    if (!settings) return NextResponse.json({ error: "Workspace settings changed. Refresh before saving." }, { status: 409, headers });
    await AuditEvent.create({ tenantId: actor.tenantId, actor: actor.email, action: `workspace.${body.action}`, target: actor.tenantId });
    return NextResponse.json({ settings }, { headers });
  } catch (e) {
    if (e instanceof SyntaxError) return NextResponse.json({ error: "Invalid request." }, { status: 400, headers });
    if ((e as { code?: number }).code === 11000) return NextResponse.json({ error: "Settings changed concurrently. Refresh and retry." }, { status: 409, headers });
    return accessErrorResponse(e) || NextResponse.json({ error: "Workspace settings could not be saved." }, { status: 503, headers });
  }
}
