import "server-only";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { AssetError } from "./asset-policy";

// Serialize quota reservations, reference checks and asset deletion across
// serverless instances. An abandoned invocation's lease expires automatically.
export async function withAssetLock<T>(tenantId: string, work: () => Promise<T>): Promise<T> {
  const locks = mongoose.connection.db!.collection<{ _id: string; token?: string; until: Date }>("assetlocks");
  try { await locks.updateOne({ _id: tenantId }, { $setOnInsert: { until: new Date(0) } }, { upsert: true }); }
  catch (e) { if ((e as { code?: number }).code !== 11000) throw e; }
  const token = randomUUID();
  // Concurrent teammates wait for short mutations rather than failing instantly.
  const deadline = Date.now() + 15000;
  let acquired;
  do {
    acquired = await locks.findOneAndUpdate({ _id: tenantId, until: { $lt: new Date() } }, { $set: { token, until: new Date(Date.now() + 120000) } }, { returnDocument: "after" });
    if (acquired) break;
    await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 200));
  } while (Date.now() < deadline);
  if (!acquired) throw new AssetError("Another asset or post update is in progress. Please retry in a moment.", 409);
  try { return await work(); }
  finally { await locks.updateOne({ _id: tenantId, token }, { $set: { until: new Date(0) }, $unset: { token: 1 } }); }
}
