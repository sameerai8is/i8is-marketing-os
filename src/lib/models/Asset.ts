import mongoose, { Schema, type Model, type Types } from "mongoose";

export interface IAsset {
  _id: Types.ObjectId;
  tenantId: string;
  name: string;
  filename: string;
  folder: string;
  tags: string[];
  altText: string;
  kind: "image" | "video" | "document" | "source" | "link";
  source: "upload" | "google_drive";
  sourceUrl?: string;
  driveId?: string;
  driveFolder?: boolean;
  driveNative?: boolean;
  driveBackupId?: string;
  driveBackupBy?: string;
  status: "uploading" | "ready";
  approval: "pending" | "approved";
  createdBy: string;
  size: number;
  mime: string;
  width?: number;
  height?: number;
  storageId?: Types.ObjectId;
  preview?: Buffer;
  checksum?: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<IAsset>({
  tenantId: { type: String, required: true }, name: { type: String, required: true, maxlength: 160 },
  filename: { type: String, default: "", maxlength: 250 }, folder: { type: String, default: "", maxlength: 80 },
  tags: { type: [String], default: [] }, altText: { type: String, default: "", maxlength: 500 },
  kind: { type: String, enum: ["image", "video", "document", "source", "link"], required: true },
  source: { type: String, enum: ["upload", "google_drive"], required: true }, sourceUrl: String, driveId: String, driveFolder: Boolean, driveNative: Boolean,
  driveBackupId: String, driveBackupBy: String,
  status: { type: String, enum: ["uploading", "ready"], required: true }, approval: { type: String, enum: ["pending", "approved"], default: "pending" },
  createdBy: { type: String, required: true }, size: { type: Number, required: true, min: 0 }, mime: { type: String, default: "application/octet-stream" },
  width: Number, height: Number, storageId: Schema.Types.ObjectId, checksum: String,
  preview: { type: Buffer, select: false }, expiresAt: Date,
}, { timestamps: true });
schema.index({ tenantId: 1, status: 1, createdAt: -1, _id: -1 });
schema.index({ tenantId: 1, folder: 1 });
export const Asset: Model<IAsset> = mongoose.models.Asset || mongoose.model<IAsset>("Asset", schema);
