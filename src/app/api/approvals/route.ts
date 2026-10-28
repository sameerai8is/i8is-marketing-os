import { NextResponse } from "next/server";
import { requireMember } from "@/lib/authorization";
import { ContentItem } from "@/lib/models/ContentItem";
import { Strategy } from "@/lib/models/Strategy";
import { Asset } from "@/lib/models/Asset";
import { ReviewThread } from "@/lib/models/ReviewThread";
import { reviewType, ReviewError } from "@/lib/review-policy";
import { assetDTO, postsWithAssets } from "@/lib/asset-storage";
import { workflowFailure, workflowHeaders } from "@/lib/workflow-response";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const a = await requireMember(), url = new URL(request.url), type = reviewType(url.searchParams.get("type") || "post"), state = url.searchParams.get("state") || "pending";
    if (!["pending", "changes", "approved"].includes(state)) throw new ReviewError("Choose a valid review status.");
    const page = Math.max(1, Math.min(10000, Math.floor(Number(url.searchParams.get("page")) || 1)));
    const threads = await ReviewThread.find({ tenantId: a.tenantId, targetType: type, $or: [{ lastDecision: "reject" }, { comments: { $elemMatch: { resolvedAt: { $exists: false } } } }] }).select("targetId lastDecision comments.resolvedAt");
    const unresolved = threads.filter(t => t.comments.some(c => !c.resolvedAt)).map(t => t.targetId), rejected = threads.filter(t => t.lastDecision === "reject").map(t => t.targetId);
    let filter: Record<string, unknown> = { tenantId: a.tenantId };
    if (type === "post") filter = { ...filter, ...(state === "approved" ? { status: { $in: ["approved", "scheduled"] } } : state === "changes" ? { $or: [{ status: "draft", _id: { $in: rejected } }, { status: "pending_approval", _id: { $in: unresolved } }] } : { $or: [{ status: "pending_approval" }, { status: "draft", _id: { $in: rejected } }] }) };
    else if (type === "asset") filter = { ...filter, status: "ready", kind: { $ne: "link" }, approval: state === "approved" ? "approved" : "pending", ...(state === "changes" ? { _id: { $in: [...new Set([...unresolved, ...rejected])] } } : {}) };
    else filter = { ...filter, ...(state === "approved" ? { status: "approved" } : state === "changes" ? { $or: [{ status: "changes_requested" }, { status: "pending_approval", _id: { $in: unresolved } }] } : { status: { $in: ["pending_approval", "changes_requested"] } }) };
    if (url.searchParams.get("mine") === "1") {
      const ids = await ReviewThread.distinct("targetId", { tenantId: a.tenantId, targetType: type, assignedTo: a.email });
      filter = { $and: [filter, { _id: { $in: ids } }] };
    }
    const skip = (page - 1) * 24;
    let items: object[], total: number;
    if (type === "post") { const [rows, count] = await Promise.all([ContentItem.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(24), ContentItem.countDocuments(filter)]); items = await postsWithAssets(rows, a.tenantId); total = count; }
    else if (type === "asset") { const [rows, count] = await Promise.all([Asset.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(24), Asset.countDocuments(filter)]); items = rows.map(assetDTO); total = count; }
    else { const [rows, count] = await Promise.all([Strategy.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(24), Strategy.countDocuments(filter)]); items = rows.map(s => s.toObject()); total = count; }
    const values = items.map(raw => JSON.parse(JSON.stringify(raw)));
    const pageThreads = await ReviewThread.find({ tenantId: a.tenantId, targetType: type, targetId: { $in: values.map(x => String(x.id || x._id)) } }).select("targetId assignedTo comments.resolvedAt");
    const normalized = values.map(raw => { const x = JSON.parse(JSON.stringify(raw)), id = x.id || x._id, thread = pageThreads.find(t => t.targetId === String(id)); return { ...x, id: String(id), reviewType: type, feedback: Boolean(thread?.comments.some(c => !c.resolvedAt)), assignedTo: thread?.assignedTo || "" }; });
    return NextResponse.json({ items: normalized, total, page, pages: Math.max(1, Math.ceil(total / 24)), admin: a.role === "admin" }, { headers: workflowHeaders });
  } catch (e) { return workflowFailure(e); }
}
