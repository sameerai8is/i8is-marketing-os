import mongoose, { Schema } from "mongoose";
const schema = new Schema({
  tenantId: { type: String, required: true }, email: { type: String, required: true }, googleSubject: { type: String, required: true },
  accessToken: { type: String, required: true, select: false }, refreshToken: { type: String, select: false },
  expiresAt: { type: Date, required: true }, scope: { type: String, required: true },
}, { timestamps: true });
schema.index({ tenantId: 1, email: 1, googleSubject: 1 }, { unique: true });
export const DriveConnection = mongoose.models.DriveConnection || mongoose.model("DriveConnection", schema);
