import mongoose, { Schema } from "mongoose";
const factSchema = new Schema({ text: { type: String, required: true, maxlength: 1000 }, source: { type: String, required: true, maxlength: 1000 }, verifiedBy: String, verifiedAt: Date }, { _id: false });
const schema = new Schema({
  tenantId: { type: String, required: true, unique: true },
  companyName: { type: String, default: "I8IS", maxlength: 200 },
  audience: { type: String, default: "", maxlength: 2000 },
  tone: { type: String, default: "Professional and clear", maxlength: 1000 },
  marketingGoal: { type: String, default: "", maxlength: 1000 },
  autonomy: { type: String, enum: ["assisted", "managed"], default: "assisted" },
  facts: { type: [factSchema], default: [] },
}, { timestamps: true });
export const WorkspaceSettings = mongoose.models.WorkspaceSettings || mongoose.model("WorkspaceSettings", schema);
