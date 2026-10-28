import { NextResponse } from "next/server";
import { requireMember, requireSameOrigin } from "@/lib/authorization";
import { Strategy } from "@/lib/models/Strategy";
import { AuditEvent } from "@/lib/models/AuditEvent";
import { strategyBrief, StrategyError } from "@/lib/strategy-policy";
import { rateLimit } from "@/lib/rate-limit";
import { workflowFailure, workflowHeaders } from "@/lib/workflow-response";
import { ContentItem } from "@/lib/models/ContentItem";
export const runtime = "nodejs";
export async function GET() {
  try {
    const a = await requireMember();
    const [items, counts] = await Promise.all([Strategy.find({ tenantId: a.tenantId }).sort({ updatedAt: -1 }).limit(100), ContentItem.aggregate<{ _id: { id: string; revision: number }; count: number }>([{ $match: { tenantId: a.tenantId, campaignId: { $exists: true } } }, { $group: { _id: { id: "$campaignId", revision: "$strategyRevision" }, count: { $sum: 1 } } }])]);
    return NextResponse.json({ items: items.map(item => ({ ...item.toObject(), generatedDrafts: counts.filter(c => c._id.id === String(item._id) && c._id.revision === item.revision).reduce((n, c) => n + c.count, 0), totalDrafts: counts.filter(c => c._id.id === String(item._id)).reduce((n, c) => n + c.count, 0) })), admin: a.role === "admin" }, { headers: workflowHeaders });
  }
  catch (e) { return workflowFailure(e); }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request); const a = await requireMember(); await rateLimit(a.id, "strategy-create", 10);
    const b = await request.json(), brief = strategyBrief(b.brief);
    if (await Strategy.countDocuments({ tenantId: a.tenantId }) >= 100) throw new StrategyError("This workspace has reached 100 strategy plans. Reuse or revise an existing plan.", 409);
    const item = await Strategy.create({ tenantId: a.tenantId, brief, createdBy: a.email });
    await AuditEvent.create({ tenantId: a.tenantId, actor: a.email, action: "strategy.created", target: String(item._id) });
    return NextResponse.json(item, { status: 201, headers: workflowHeaders });
  } catch (e) { return workflowFailure(e); }
}
