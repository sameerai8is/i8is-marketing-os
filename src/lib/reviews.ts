import "server-only";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { ReviewThread } from "./models/ReviewThread";
import { ContentItem } from "./models/ContentItem";
import { Asset } from "./models/Asset";
import { Strategy } from "./models/Strategy";
import { ReviewError, reviewNote, type ReviewType } from "./review-policy";
type Actor = { tenantId: string; email: string; role: string };
export const threadFilter = (tenantId: string, type: ReviewType, id: string) => ({ tenantId, targetType: type, targetId: id });
export async function reviewTarget(tenantId: string, type: ReviewType, id: string) {
  if (!mongoose.isValidObjectId(id)) throw new ReviewError("Review item not found.", 404);
  const filter = { tenantId, _id: id };
  const target = type === "post" ? await ContentItem.findOne(filter) : type === "asset" ? await Asset.findOne({ ...filter, status: "ready", kind: { $ne: "link" } }) : await Strategy.findOne(filter);
  if (!target) throw new ReviewError("Review item not found.", 404);
  return target;
}
export async function assertReviewAllowed(actor: Actor, type: ReviewType, id: string, approving = false) {
  if (actor.role !== "admin") throw new ReviewError("Only administrators can make review decisions.", 403);
  const thread = await ReviewThread.findOne(threadFilter(actor.tenantId, type, id));
  if (thread?.assignedTo && thread.assignedTo !== actor.email) throw new ReviewError("This review is assigned to another administrator. Reassign it in Approvals first.", 403);
  if (approving && thread?.comments.some(c => !c.resolvedAt)) throw new ReviewError("Resolve open review comments before approving.", 409);
}
export async function recordReviewDecision(actor: Actor, type: ReviewType, id: string, version: string, action: string, note?: unknown) {
  const text = reviewNote(note);
  await ReviewThread.init();
  const comments = text ? [{ id: randomUUID(), actor: actor.email, text, version, createdAt: new Date() }] : [];
  await ReviewThread.findOneAndUpdate(threadFilter(actor.tenantId, type, id), {
    $set: { lastDecision: action },
    $push: { decisions: { $each: [{ action, actor: actor.email, version, createdAt: new Date() }], $slice: -100 }, ...(comments.length ? { comments: { $each: comments } } : {}) },
  }, { upsert: true, runValidators: true });
}
