import mongoose, { Schema, type Model, type Types } from "mongoose";
import type { StrategyBrief, StrategyPlan, StrategyStatus } from "../strategy-policy";
export interface IStrategy {
  _id: Types.ObjectId; tenantId: string; brief: StrategyBrief; plan?: StrategyPlan;
  sourceFacts: { text: string; source: string }[]; researchNotes: string[]; knowledgeVersion?: string;
  status: StrategyStatus; revision: number; createdBy: string; approvedBy?: string; approvedAt?: Date;
  createdAt: Date; updatedAt: Date;
}
const schema = new Schema<IStrategy>({
  tenantId: { type: String, required: true }, brief: { type: Schema.Types.Mixed, required: true }, plan: Schema.Types.Mixed,
  sourceFacts: { type: [{ text: String, source: String, _id: false }], default: [] }, researchNotes: { type: [String], default: [] }, knowledgeVersion: String,
  status: { type: String, enum: ["draft", "pending_approval", "changes_requested", "approved"], default: "draft" }, revision: { type: Number, default: 1 },
  createdBy: { type: String, required: true }, approvedBy: String, approvedAt: Date,
}, { timestamps: true });
schema.index({ tenantId: 1, updatedAt: -1, _id: -1 });
export const Strategy: Model<IStrategy> = mongoose.models.Strategy || mongoose.model<IStrategy>("Strategy", schema);
