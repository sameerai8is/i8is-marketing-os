import mongoose, { Schema } from "mongoose";
const schema = new Schema({ tenantId: { type: String, unique: true, required: true }, website: String, companyName: String, goal: String, market: String, startedAt: Date, status: { type: String, enum: ["starting", "running", "ready", "failed"] }, responseId: { type: String, select: false }, error: String, sources: [String], report: Schema.Types.Mixed, leaseUntil: Date, startedBy: String }, { timestamps: true });
export const ResearchRun = mongoose.models.ResearchRun || mongoose.model("ResearchRun", schema);
