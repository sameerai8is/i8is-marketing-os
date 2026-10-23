import mongoose, { Schema, Document, Model } from "mongoose";

export interface IBrandProfile extends Document {
  companyName: string;
  description: string;
  targetAudience: string;
  tone: string;
  products: string[];
  approvedClaims: string[];
  competitors: string[];
  website: string;
  createdAt: Date;
  updatedAt: Date;
}

const BrandProfileSchema = new Schema<IBrandProfile>(
  {
    companyName: { type: String, required: true, default: "I8IS" },
    description: String,
    targetAudience: String,
    tone: String,
    products: [String],
    approvedClaims: [String],
    competitors: [String],
    website: String,
  },
  { timestamps: true }
);

export const BrandProfile: Model<IBrandProfile> =
  mongoose.models.BrandProfile ||
  mongoose.model<IBrandProfile>("BrandProfile", BrandProfileSchema);
