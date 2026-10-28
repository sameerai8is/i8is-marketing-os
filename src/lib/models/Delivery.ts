import mongoose, { Schema, type Model, type Types } from "mongoose";

export interface IDelivery {
  _id: Types.ObjectId; tenantId: string; postId: string; activeKey?: string; contentVersion: string;
  title: string; text: string; platform: string; assetIds: string[]; channelId: string; channelName: string;
  mode: "shareNow" | "customScheduled"; dueAt?: Date; state: string; providerId?: string; providerStatus?: string;
  externalLink?: string; sentAt?: Date; attempts: number; requestedBy: string; requestedById: string;
  error?: string; code?: string; retryAfter?: Date; operationAt?: Date; checkedAt?: Date; nextCheckAt: Date;
  mediaExpiresAt: Date; history: { at: Date; action: string; actor: string }[]; createdAt: Date; updatedAt: Date;
  returnToDraft?: boolean;
}
const schema = new Schema<IDelivery>({
  tenantId: { type: String, required: true }, postId: { type: String, required: true }, activeKey: String, contentVersion: String,
  title: String, text: String, platform: String, assetIds: [String], channelId: String, channelName: String,
  mode: { type: String, enum: ["shareNow", "customScheduled"] }, dueAt: Date,
  state: { type: String, required: true, enum: ["prepared", "submitting", "queued", "published", "rejected", "uncertain", "failed", "attention", "cancelling", "cancel_uncertain", "cancelled"] },
  providerId: String, providerStatus: String, externalLink: String, sentAt: Date, attempts: { type: Number, default: 0 },
  requestedBy: String, requestedById: String, error: String, code: String, retryAfter: Date, operationAt: Date,
  checkedAt: Date, nextCheckAt: { type: Date, default: Date.now }, mediaExpiresAt: Date,
  returnToDraft: Boolean,
  history: [{ at: Date, action: String, actor: String, _id: false }],
}, { timestamps: true });
schema.index({ activeKey: 1 }, { unique: true, sparse: true });
schema.index({ tenantId: 1, createdAt: -1 });
schema.index({ state: 1, nextCheckAt: 1 });
schema.index({ tenantId: 1, providerId: 1 }, { unique: true, partialFilterExpression: { providerId: { $type: "string" } } });
export const Delivery: Model<IDelivery> = mongoose.models.Delivery || mongoose.model<IDelivery>("Delivery", schema);
