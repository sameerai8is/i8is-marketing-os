import { NextResponse } from "next/server";
import { requireMember, requireSameOrigin } from "@/lib/authorization";
import { Strategy } from "@/lib/models/Strategy";
import { WorkspaceSettings } from "@/lib/models/WorkspaceSettings";
import { ContentItem } from "@/lib/models/ContentItem";
import { AuditEvent } from "@/lib/models/AuditEvent";
import { generateDraft } from "@/lib/ai-draft";
import { StrategyError } from "@/lib/strategy-policy";
import { reviewTarget } from "@/lib/reviews";
import { withAssetLock } from "@/lib/asset-lock";
import { rateLimit } from "@/lib/rate-limit";
import { postsWithAssets } from "@/lib/asset-storage";
import { workflowFailure, workflowHeaders } from "@/lib/workflow-response";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(_r: Request, c: { params: Promise<{ id: string }> }) {
  try { const a = await requireMember(), { id } = await c.params; await reviewTarget(a.tenantId, "strategy", id); const strategy = (await Strategy.findOne({ _id: id, tenantId: a.tenantId }))!; return NextResponse.json({ items: await ContentItem.find({ tenantId: a.tenantId, campaignId: id, strategyRevision: strategy.revision }).select("title strategyIdeaIndex status plannedAt updatedAt") }, { headers: workflowHeaders }); }
  catch (e) { return workflowFailure(e); }
}
export async function POST(request: Request, c: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request); const a = await requireMember(); const { id } = await c.params, b = await request.json();
    await reviewTarget(a.tenantId, "strategy", id); const strategy = (await Strategy.findOne({ _id: id, tenantId: a.tenantId }))!;
    if (strategy.status !== "approved" || strategy.revision !== b.revision) throw new StrategyError("Use the current approved strategy revision to generate campaign drafts.", 409);
    if (!Number.isInteger(b.ideaIndex) || b.ideaIndex < 0 || !strategy.plan?.campaigns[b.ideaIndex]) throw new StrategyError("Choose a campaign idea from this strategy.");
    const filter = { tenantId: a.tenantId, campaignId: id, strategyRevision: strategy.revision, strategyIdeaIndex: b.ideaIndex };
    const existing = await ContentItem.findOne(filter);
    if (existing) return NextResponse.json((await postsWithAssets([existing], a.tenantId))[0], { headers: workflowHeaders });
    await rateLimit(a.id, "strategy-draft", 12);
    const idea = strategy.plan.campaigns[b.ideaIndex], settings = await WorkspaceSettings.findOne({ tenantId: a.tenantId });
    const facts = idea.factIds.map(i => strategy.sourceFacts[i]);
    if (!facts.length || facts.some(f => !f || !settings?.facts.some((x: { text: string; source: string }) => x.text === f.text && x.source === f.source))) throw new StrategyError("Reviewed facts for this idea changed. Generate and approve an updated strategy first.", 409);
    if (!process.env.OPENAI_API_KEY) throw new StrategyError("AI generation is not configured.", 503);
    const draft = await generateDraft({ prompt: `${idea.name}. ${idea.brief}. Call to action: ${idea.cta}. Desired format: ${idea.format}. These are creative preferences, not evidence. Use only the reviewed company facts.`.slice(0, 1000), platform: idea.platform, companyName: settings.companyName, tone: settings.tone, audience: strategy.brief.audience, facts }, process.env.OPENAI_API_KEY);
    await requireMember();
    return await withAssetLock(a.tenantId, async () => {
      const current = await Strategy.findOne({ _id: id, tenantId: a.tenantId, status: "approved", revision: strategy.revision, updatedAt: strategy.updatedAt });
      if (!current) throw new StrategyError("Strategy changed during generation. No draft was saved; review the new revision.", 409);
      const knowledge = await WorkspaceSettings.findOne({ tenantId: a.tenantId });
      if (facts.some(f => !knowledge?.facts.some((x: { text: string; source: string }) => x.text === f.text && x.source === f.source))) throw new StrategyError("Company DNA changed during generation. Retry with an updated strategy.", 409);
      await ContentItem.init();
      const prior = await ContentItem.findOne(filter);
      if (prior) return NextResponse.json((await postsWithAssets([prior], a.tenantId))[0], { headers: workflowHeaders });
      const date = new Date(`${strategy.brief.startDate}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + idea.day - 1);
      const item = await ContentItem.create({ ...draft, ...filter, status: "draft", assetIds: [], plannedAt: date.toISOString().slice(0, 10), createdBy: a.email });
      await AuditEvent.create({ tenantId: a.tenantId, actor: a.email, action: "strategy.draft_generated", target: String(item._id) });
      return NextResponse.json((await postsWithAssets([item], a.tenantId))[0], { status: 201, headers: workflowHeaders });
    });
  } catch (e) { return workflowFailure(e); }
}
