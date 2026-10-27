import { NextResponse } from "next/server";
import { accessErrorResponse, requireMember, requireSameOrigin } from "@/lib/authorization";
import { WorkspaceSettings } from "@/lib/models/WorkspaceSettings";
import { ContentItem } from "@/lib/models/ContentItem";
import { AuditEvent } from "@/lib/models/AuditEvent";
import { rateLimit } from "@/lib/rate-limit";
import { generateDraft, DraftGenerationError } from "@/lib/ai-draft";
import { platforms } from "@/lib/content-policy";
import { attachmentIds, AssetError } from "@/lib/asset-policy";
import { withAssetLock } from "@/lib/asset-lock";
import { postsWithAssets, validateAssetReferences } from "@/lib/asset-storage";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    requireSameOrigin(request);
    const actor = await requireMember();
    await rateLimit(actor.id, "ai-draft", 5);
    const body = await request.json();
    if (typeof body?.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 1000 || !platforms.includes(body.platform)) return NextResponse.json({ error: "Describe a goal in 1–1,000 characters and choose a channel." }, { status: 400, headers });
    const ids = attachmentIds(body.assetIds);
    await validateAssetReferences(actor.tenantId, ids);
    const settings = await WorkspaceSettings.findOne({ tenantId: actor.tenantId });
    if (!settings?.facts?.length) return NextResponse.json({ error: "Add reviewed company facts with sources in Company DNA first." }, { status: 409, headers });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "AI generation is not configured on the server." }, { status: 503, headers });
    const draft = await generateDraft({ prompt: body.prompt.trim(), platform: body.platform, companyName: settings.companyName, tone: settings.tone, audience: settings.audience, facts: settings.facts.map((f: { text: string; source: string }) => ({ text: f.text, source: f.source })) }, process.env.OPENAI_API_KEY);
    // A revocation during generation must take effect before persisting output.
    await requireMember();
    const item = await withAssetLock(actor.tenantId, async () => { await validateAssetReferences(actor.tenantId, ids); return ContentItem.create({ ...draft, status: "draft", tenantId: actor.tenantId, assetIds: ids }); });
    await AuditEvent.create({ tenantId: actor.tenantId, actor: actor.email, action: "content.generated", target: item.id });
    return NextResponse.json((await postsWithAssets([item], actor.tenantId))[0], { status: 201, headers });
  } catch (e) {
    if (e instanceof AssetError) return NextResponse.json({ error: e.message }, { status: e.status, headers });
    if (e instanceof DraftGenerationError) return NextResponse.json({ error: e.message }, { status: e.status, headers });
    if (e instanceof SyntaxError) return NextResponse.json({ error: "Invalid request." }, { status: 400, headers });
    return accessErrorResponse(e) || NextResponse.json({ error: "A draft could not be generated. Please retry." }, { status: 503, headers });
  }
}
