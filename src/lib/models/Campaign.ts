import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICampaign extends Document {
  tenantId: string;
  name: string;
  objective: string;
  targetAudience: string;
  channels: string[];
  status: "draft" | "pending_approval" | "active" | "completed" | "paused";
  startDate?: Date;
  endDate?: Date;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignSchema = new Schema<ICampaign>(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    objective: { type: String, required: true },
    targetAudience: String,
    channels: [String],
    status: {
      type: String,
      enum: ["draft", "pending_approval", "active", "completed", "paused"],
      default: "draft",
    },
    startDate: Date,
    endDate: Date,
    description: String,
  },
  { timestamps: true }
);

export const Campaign: Model<ICampaign> =
  mongoose.models.Campaign || mongoose.model<ICampaign>("Campaign", CampaignSchema);
