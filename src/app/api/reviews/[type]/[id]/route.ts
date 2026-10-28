import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireMember, requireSameOrigin } from "@/lib/authorization";
import { ReviewThread } from "@/lib/models/ReviewThread";
import { WorkspaceMember } from "@/lib/models/WorkspaceMember";
import { reviewType, reviewNote, ReviewError } from "@/lib/review-policy";
import { reviewTarget, threadFilter } from "@/lib/reviews";
import { withAssetLock } from "@/lib/asset-lock";
import { rateLimit } from "@/lib/rate-limit";
import { workflowFailure, workflowHeaders } from "@/lib/workflow-response";
export const runtime = "nodejs";
type Context = { params: Promise<{ type: string; id: string }> };
export async function GET(_r: Request, c: Context) {
  try {
    const a = await requireMember(), p = await c.params, type = reviewType(p.type);
    const item = await reviewTarget(a.tenantId, type, p.id);
    const [thread, reviewers] = await Promise.all([ReviewThread.findOne(threadFilter(a.tenantId, type, p.id)), WorkspaceMember.find({ tenantId: a.tenantId, role: "admin", status: "active" }).select("email name -_id").lean()]);
    return NextResponse.json({ thread, reviewers, actorEmail: a.email, admin: a.role === "admin", version: item.updatedAt.toISOString() }, { headers: workflowHeaders });
  } catch (e) { return workflowFailure(e); }
}
export async function PATCH(request: Request, c: Context) {
  try {
    requireSameOrigin(request); const a = await requireMember(); await rateLimit(a.id, "review-write", 40);
    const p = await c.params, type = reviewType(p.type), b = await request.json();
    return await withAssetLock(a.tenantId, async () => {
      const item = await reviewTarget(a.tenantId, type, p.id);
      if (b.version !== item.updatedAt.toISOString()) throw new ReviewError("This item changed. Reload its latest version before reviewing.", 409);
      const filter = threadFilter(a.tenantId, type, p.id); await ReviewThread.init();
      if (b.action === "comment") {
        const text = reviewNote(b.text, true), existing = await ReviewThread.findOne(filter);
        if ((existing?.comments.length || 0) >= 1000) throw new ReviewError("This discussion has reached 1,000 comments.", 409);
        await ReviewThread.findOneAndUpdate(filter, { $push: { comments: { id: randomUUID(), actor: a.email, text, version: b.version, createdAt: new Date() } } }, { upsert: true, runValidators: true });
      } else if (b.action === "resolve") {
        const thread = await ReviewThread.findOne(filter), comment = thread?.comments.find(x => x.id === b.commentId);
        if (!comment) throw new ReviewError("Comment not found.", 404);
        if (a.role !== "admin" && comment.actor !== a.email) throw new ReviewError("Only the comment author or an administrator can resolve it.", 403);
        await ReviewThread.updateOne({ ...filter, "comments.id": b.commentId }, { $set: { "comments.$.resolvedAt": new Date(), "comments.$.resolvedBy": a.email } });
      } else if (b.action === "assign") {
        if (a.role !== "admin") throw new ReviewError("Only administrators can assign reviewers.", 403);
        if (typeof b.email !== "string" || b.email && !await WorkspaceMember.exists({ tenantId: a.tenantId, email: b.email, role: "admin", status: "active" })) throw new ReviewError("Choose an active administrator from this workspace.");
        await ReviewThread.findOneAndUpdate(filter, b.email ? { $set: { assignedTo: b.email } } : { $unset: { assignedTo: 1 } }, { upsert: true, runValidators: true });
      } else throw new ReviewError("Choose a supported review action.");
      return NextResponse.json({ thread: await ReviewThread.findOne(filter) }, { headers: workflowHeaders });
    });
  } catch (e) { return workflowFailure(e); }
}
