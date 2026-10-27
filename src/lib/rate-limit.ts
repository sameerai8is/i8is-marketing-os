import "server-only";
import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { AccessError } from "./authorization";

// Shared counters work across Vercel instances; no in-memory security limit.
export async function rateLimit(actor: string, action: string, limit = 30) {
  const bucket = Math.floor(Date.now() / 60000);
  const key = createHash("sha256").update(`${actor}:${action}:${bucket}`).digest("hex");
  const counters = mongoose.connection.db!.collection<{ _id: string; count: number; expiresAt: Date }>("requestlimits");
  const record = await counters.findOneAndUpdate({ _id: key }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + 120000) } }, { upsert: true, returnDocument: "after" });
  if ((record?.count || 0) > limit) throw new AccessError(429, "RATE_LIMITED");
  // Best-effort cleanup is bounded to old counters; no membership/content writes.
  await counters.deleteMany({ expiresAt: { $lt: new Date() } });
}
