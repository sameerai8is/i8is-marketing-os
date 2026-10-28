import mongoose, { Schema, type Model, type Types } from "mongoose";
import type { ReviewType } from "../review-policy";
export interface IReviewThread {
  _id: Types.ObjectId; tenantId: string; targetType: ReviewType; targetId: string; assignedTo?: string;
  lastDecision?: string;
  comments: { id: string; actor: string; text: string; version: string; createdAt: Date; resolvedBy?: string; resolvedAt?: Date }[];
  decisions: { action: string; actor: string; version: string; createdAt: Date }[];
  createdAt: Date; updatedAt: Date;
}
const schema = new Schema<IReviewThread>({
  tenantId: { type: String, required: true }, targetType: { type: String, enum: ["post", "asset", "strategy"], required: true }, targetId: { type: String, required: true }, assignedTo: String, lastDecision: String,
  comments: { type: [{ _id: false, id: String, actor: String, text: { type: String, maxlength: 2000 }, version: String, createdAt: Date, resolvedBy: String, resolvedAt: Date }], default: [] },
  decisions: { type: [{ _id: false, action: String, actor: String, version: String, createdAt: Date }], default: [] },
}, { timestamps: true });
schema.index({ tenantId: 1, targetType: 1, targetId: 1 }, { unique: true });
export const ReviewThread: Model<IReviewThread> = mongoose.models.ReviewThread || mongoose.model<IReviewThread>("ReviewThread", schema);
