import mongoose, { Schema, Document, Model } from "mongoose";

export interface IContentItem extends Document {
  title: string;
  body: string;
  platform: "linkedin" | "facebook" | "instagram" | "twitter";
  status: "draft" | "pending_approval" | "scheduled" | "published" | "failed";
  scheduledAt?: Date;
  publishedAt?: Date;
  campaignId?: string;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ContentItemSchema = new Schema<IContentItem>(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    platform: {
      type: String,
      enum: ["linkedin", "facebook", "instagram", "twitter"],
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "pending_approval", "scheduled", "published", "failed"],
      default: "draft",
    },
    scheduledAt: Date,
    publishedAt: Date,
    campaignId: String,
    imageUrl: String,
  },
  { timestamps: true }
);

export const ContentItem: Model<IContentItem> =
  mongoose.models.ContentItem || mongoose.model<IContentItem>("ContentItem", ContentItemSchema);
