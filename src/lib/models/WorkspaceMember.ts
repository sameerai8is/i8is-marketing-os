import mongoose, { Schema, type Model } from "mongoose";

export interface IWorkspaceMember {
  tenantId: string;
  email: string;
  name: string;
  role: "admin" | "member";
  status: "invited" | "active" | "blocked";
  googleSubject?: string;
  inviteExpiresAt?: Date;
  invitedBy?: string;
  lastSignInAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IWorkspaceMember>({
  tenantId: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  name: { type: String, default: "", maxlength: 200 },
  role: { type: String, enum: ["admin", "member"], default: "member", required: true },
  status: { type: String, enum: ["invited", "active", "blocked"], required: true },
  googleSubject: { type: String, select: false },
  inviteExpiresAt: Date,
  invitedBy: String,
  lastSignInAt: Date,
}, { timestamps: true });
schema.index({ tenantId: 1, email: 1 }, { unique: true });
schema.index({ tenantId: 1, googleSubject: 1 }, { unique: true, partialFilterExpression: { googleSubject: { $type: "string" } } });

export const WorkspaceMember: Model<IWorkspaceMember> = mongoose.models.WorkspaceMember || mongoose.model<IWorkspaceMember>("WorkspaceMember", schema);
