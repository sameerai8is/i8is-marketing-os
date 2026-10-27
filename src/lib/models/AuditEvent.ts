import mongoose, { Schema } from "mongoose";

const schema = new Schema({
  tenantId: { type: String, required: true, index: true },
  actor: { type: String, required: true },
  action: { type: String, required: true },
  target: { type: String, required: true },
}, { timestamps: true });
export const AuditEvent = mongoose.models.AuditEvent || mongoose.model("AuditEvent", schema);
