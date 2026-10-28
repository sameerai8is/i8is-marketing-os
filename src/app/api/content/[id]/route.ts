import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { accessErrorResponse, requireMember, requireSameOrigin } from "@/lib/authorization";
import { ContentItem } from "@/lib/models/ContentItem";
import { AuditEvent } from "@/lib/models/AuditEvent";
import { ContentError, draftFields, transition, plannedDate } from "@/lib/content-policy";
import { rateLimit } from "@/lib/rate-limit";
import { AssetError, attachmentIds } from "@/lib/asset-policy";
import { withAssetLock } from "@/lib/asset-lock";
import { postsWithAssets, validateAssetReferences } from "@/lib/asset-storage";
import { assertReviewAllowed, recordReviewDecision } from "@/lib/reviews";
import { ReviewError, reviewNote } from "@/lib/review-policy";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
async function mutate(request: Request, context: { params: Promise<{ id: string }> }, remove = false) {
  try {
    requireSameOrigin(request);
    const actor = await requireMember();
    await rateLimit(actor.id, "content-write");
    return await withAssetLock(actor.tenantId, async () => {
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Post not found." }, { status: 404, headers });
    const item = await ContentItem.findOne({ _id: id, tenantId: actor.tenantId });
    if (!item) return NextResponse.json({ error: "Post not found." }, { status: 404, headers });
    if (item.publishingId) return NextResponse.json({ error: "This post has a publishing request. Use Publishing Monitor to check or cancel it before editing or deleting." }, { status: 409, headers });
    const body = await request.json();
    if (body?.updatedAt !== item.updatedAt.toISOString()) return NextResponse.json({ error: "This post changed since you opened it. Refresh before saving." }, { status: 409, headers });
    const filter = { _id: item._id, tenantId: actor.tenantId, updatedAt: item.updatedAt };
    if (remove) {
      if (item.status !== "draft" && actor.role !== "admin") return NextResponse.json({ error: "Only administrators can delete content after it leaves draft." }, { status: 403, headers });
      const result = await ContentItem.deleteOne(filter);
      if (!result.deletedCount) return NextResponse.json({ error: "This post changed. Refresh and retry." }, { status: 409, headers });
      await AuditEvent.create({ tenantId: actor.tenantId, actor: actor.email, action: "content.deleted", target: id });
      return NextResponse.json({ message: "Post deleted." }, { headers });
    }
    let fields;
    let clearPlannedDate = false;
    if (body?.action === "save") {
      if (["published", "failed"].includes(item.status)) throw new ContentError("Create a new draft to revise delivered or failed content.");
      const ids = body.assetIds === undefined ? item.assetIds || [] : attachmentIds(body.assetIds);
      await validateAssetReferences(actor.tenantId, ids);
      const date = body.plannedAt === undefined ? item.plannedAt : plannedDate(body.plannedAt);
      clearPlannedDate = !date;
      fields = { ...draftFields(body), assetIds: ids, status: "draft", ...(date ? { plannedAt: date } : {}) };
    } else {
      if (body?.action !== "submit" && actor.role !== "admin") return NextResponse.json({ error: "Only administrators can approve or schedule content." }, { status: 403, headers });
      fields = transition(item.status, body?.action, actor.role === "admin", body?.scheduledAt);
      if (["approve", "reject"].includes(body?.action)) { reviewNote(body.note); await assertReviewAllowed(actor, "post", id, body.action === "approve"); }
      if (["submit", "approve", "schedule"].includes(body?.action)) await validateAssetReferences(actor.tenantId, item.assetIds || [], true);
    }
    const updated = await ContentItem.findOneAndUpdate(filter, { $set: fields, ...(!("scheduledAt" in fields) ? { $unset: { scheduledAt: 1, ...(clearPlannedDate ? { plannedAt: 1 } : {}) } } : {}) }, { new: true, runValidators: true });
    if (!updated) return NextResponse.json({ error: "This post changed. Refresh and retry." }, { status: 409, headers });
    if (["submit", "approve", "reject"].includes(body?.action)) await recordReviewDecision(actor, "post", id, item.updatedAt.toISOString(), body.action, body.action === "reject" ? body.note : undefined);
    await AuditEvent.create({ tenantId: actor.tenantId, actor: actor.email, action: `content.${body.action}`, target: id });
    return NextResponse.json((await postsWithAssets([updated], actor.tenantId))[0], { headers });
    });
  } catch (error) {
    if (error instanceof ReviewError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    if (error instanceof AssetError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    if (error instanceof ContentError || error instanceof SyntaxError || error instanceof mongoose.Error.ValidationError) return NextResponse.json({ error: error instanceof ContentError ? error.message : "Invalid content." }, { status: 400, headers });
    return accessErrorResponse(error) || NextResponse.json({ error: "Content could not be updated. Please retry." }, { status: 503, headers });
  }
}
export const PATCH = (r: Request, c: { params: Promise<{ id: string }> }) => mutate(r, c);
export const DELETE = (r: Request, c: { params: Promise<{ id: string }> }) => mutate(r, c, true);

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireMember(), { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Post not found." }, { status: 404, headers });
    const item = await ContentItem.findOne({ _id: id, tenantId: actor.tenantId });
    if (!item) return NextResponse.json({ error: "Post not found." }, { status: 404, headers });
    return NextResponse.json((await postsWithAssets([item], actor.tenantId))[0], { headers });
  } catch (e) { return accessErrorResponse(e) || NextResponse.json({ error: "Post could not be loaded." }, { status: 503, headers }); }
}
