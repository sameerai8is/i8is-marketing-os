import mongoose, { Schema, Document, Model } from "mongoose";

export interface IContentItem extends Document {
  tenantId: string;
  title: string;
  body: string;
  platform: "linkedin" | "facebook" | "instagram" | "twitter";
  status: "draft" | "pending_approval" | "approved" | "scheduled" | "published" | "failed";
  scheduledAt?: Date;
  publishedAt?: Date;
  campaignId?: string;
  imageUrl?: string;
  sourceFacts?: { text: string; source: string }[];
  assetIds?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ContentItemSchema = new Schema<IContentItem>(
  {
    tenantId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, trim: true, maxlength: 10000 },
    platform: {
      type: String,
      enum: ["linkedin", "facebook", "instagram", "twitter"],
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "pending_approval", "approved", "scheduled", "published", "failed"],
      default: "draft",
    },
    scheduledAt: Date,
    publishedAt: Date,
    campaignId: String,
    imageUrl: String,
    sourceFacts: [{ text: String, source: String, _id: false }],
    assetIds: { type: [String], default: [] },
  },
  { timestamps: true }
);

ContentItemSchema.index({ tenantId: 1, scheduledAt: -1 });
ContentItemSchema.index({ tenantId: 1, assetIds: 1 });

export const ContentItem: Model<IContentItem> =
  mongoose.models.ContentItem || mongoose.model<IContentItem>("ContentItem", ContentItemSchema);
