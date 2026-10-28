import { NextResponse } from "next/server";
import { requireMember, requireSameOrigin } from "@/lib/authorization";
import { Strategy } from "@/lib/models/Strategy";
import { WorkspaceSettings } from "@/lib/models/WorkspaceSettings";
import { ResearchRun } from "@/lib/models/ResearchRun";
import { AuditEvent } from "@/lib/models/AuditEvent";
import { generateStrategy } from "@/lib/strategy-ai";
import { StrategyError } from "@/lib/strategy-policy";
import { reviewTarget } from "@/lib/reviews";
import { withAssetLock } from "@/lib/asset-lock";
import { rateLimit } from "@/lib/rate-limit";
import { workflowFailure, workflowHeaders } from "@/lib/workflow-response";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request, c: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request); const a = await requireMember(); await rateLimit(a.id, "strategy-generate", 3); const { id } = await c.params, b = await request.json();
    await reviewTarget(a.tenantId, "strategy", id); const item = (await Strategy.findOne({ _id: id, tenantId: a.tenantId }))!;
    if (b.updatedAt !== item.updatedAt.toISOString()) throw new StrategyError("Save or reload the latest strategy brief before generating.", 409);
    const settings = await WorkspaceSettings.findOne({ tenantId: a.tenantId });
    if (!settings?.facts?.length) throw new StrategyError("Review and save at least one Company DNA fact first.", 409);
    if (!process.env.OPENAI_API_KEY) throw new StrategyError("AI generation is not configured.", 503);
    const research = await ResearchRun.findOne({ tenantId: a.tenantId, status: "ready" });
    const researchNotes = (research?.report?.competitors || []).slice(0, 5).map((x: { name: string; reason: string; source: string }) => `Unreviewed competitor hypothesis: ${x.name}: ${x.reason}. Source: ${x.source}`);
    const facts = settings.facts.map((f: { text: string; source: string }) => ({ text: f.text, source: f.source }));
    const plan = await generateStrategy(item.brief, { companyName: settings.companyName, tone: settings.tone, facts, researchNotes }, process.env.OPENAI_API_KEY);
    await requireMember();
    return await withAssetLock(a.tenantId, async () => {
      const currentKnowledge = await WorkspaceSettings.findOne({ tenantId: a.tenantId });
      if (currentKnowledge?.updatedAt.toISOString() !== settings.updatedAt.toISOString()) throw new StrategyError("Company DNA changed during generation. Retry using the new facts.", 409);
      const updated = await Strategy.findOneAndUpdate({ _id: id, tenantId: a.tenantId, updatedAt: item.updatedAt }, { $set: { plan, sourceFacts: facts, researchNotes, knowledgeVersion: settings.updatedAt.toISOString(), status: "draft", revision: item.revision + 1 }, $unset: { approvedBy: 1, approvedAt: 1 } }, { new: true, runValidators: true });
      if (!updated) throw new StrategyError("The strategy changed during generation. Reload and retry.", 409);
      await AuditEvent.create({ tenantId: a.tenantId, actor: a.email, action: "strategy.generated", target: id });
      return NextResponse.json(updated, { headers: workflowHeaders });
    });
  } catch (e) { return workflowFailure(e); }
}
