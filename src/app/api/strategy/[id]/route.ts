import { NextResponse } from "next/server";
import { requireMember, requireSameOrigin } from "@/lib/authorization";
import { Strategy } from "@/lib/models/Strategy";
import { WorkspaceSettings } from "@/lib/models/WorkspaceSettings";
import { AuditEvent } from "@/lib/models/AuditEvent";
import { strategyBrief, strategyPlan, strategyTransition, StrategyError } from "@/lib/strategy-policy";
import { assertReviewAllowed, recordReviewDecision, reviewTarget } from "@/lib/reviews";
import { reviewNote } from "@/lib/review-policy";
import { withAssetLock } from "@/lib/asset-lock";
import { rateLimit } from "@/lib/rate-limit";
import { workflowFailure, workflowHeaders } from "@/lib/workflow-response";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(_r: Request, c: Context) {
  try { const a = await requireMember(), { id } = await c.params; return NextResponse.json(await reviewTarget(a.tenantId, "strategy", id), { headers: workflowHeaders }); }
  catch (e) { return workflowFailure(e); }
}
export async function PATCH(request: Request, c: Context) {
  try {
    requireSameOrigin(request); const a = await requireMember(); await rateLimit(a.id, "strategy-write", 30); const { id } = await c.params, b = await request.json();
    return await withAssetLock(a.tenantId, async () => {
      await reviewTarget(a.tenantId, "strategy", id); const item = (await Strategy.findOne({ _id: id, tenantId: a.tenantId }))!;
      if (b.updatedAt !== item.updatedAt.toISOString()) throw new StrategyError("This strategy changed. Reload it before saving or reviewing.", 409);
      let values: Record<string, unknown>;
      let clearPlan = false;
      if (b.action === "save") {
        const brief = strategyBrief(b.brief); clearPlan = b.resetPlan === true || JSON.stringify(brief) !== JSON.stringify(item.brief);
        const plan = !clearPlan && b.plan ? strategyPlan(b.plan, brief, item.sourceFacts.length) : undefined;
        values = { brief, ...(plan ? { plan } : {}), ...(clearPlan ? { sourceFacts: [], researchNotes: [] } : {}), status: "draft", revision: item.revision + 1 };
      } else {
        if (!item.plan) throw new StrategyError("Generate and review a strategy plan before submitting it.", 409);
        const status = strategyTransition(item.status, b.action, a.role === "admin");
        if (["approve", "reject"].includes(b.action)) await assertReviewAllowed(a, "strategy", id, b.action === "approve");
        if (b.action === "reject") reviewNote(b.note, true);
        if (b.action === "approve") {
          const settings = await WorkspaceSettings.findOne({ tenantId: a.tenantId });
          if (item.sourceFacts.some(f => !settings?.facts.some((x: { text: string; source: string }) => x.text === f.text && x.source === f.source))) throw new StrategyError("Company DNA changed. Generate a new strategy using the current reviewed facts.", 409);
        }
        values = { status, ...(status === "approved" ? { approvedBy: a.email, approvedAt: new Date() } : {}) };
      }
      const itemUpdated = await Strategy.findOneAndUpdate({ _id: id, tenantId: a.tenantId, updatedAt: item.updatedAt }, { $set: values, ...(values.status !== "approved" ? { $unset: { approvedBy: 1, approvedAt: 1, ...(clearPlan ? { plan: 1 } : {}) } } : {}) }, { new: true, runValidators: true });
      if (!itemUpdated) throw new StrategyError("This strategy changed. Reload and retry.", 409);
      if (b.action !== "save") await recordReviewDecision(a, "strategy", id, item.updatedAt.toISOString(), b.action, b.action === "reject" ? b.note : undefined);
      await AuditEvent.create({ tenantId: a.tenantId, actor: a.email, action: `strategy.${b.action}`, target: id });
      return NextResponse.json(itemUpdated, { headers: workflowHeaders });
    });
  } catch (e) { return workflowFailure(e); }
}
