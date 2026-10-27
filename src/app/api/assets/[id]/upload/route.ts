import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { requireMember, requireSameOrigin } from "@/lib/authorization";
import { Asset } from "@/lib/models/Asset";
import { AuditEvent } from "@/lib/models/AuditEvent";
import { withAssetLock } from "@/lib/asset-lock";
import { AssetError, UPLOAD_CHUNK_BYTES } from "@/lib/asset-policy";
import { assetIndexes, parts, persistFile, assetDTO } from "@/lib/asset-storage";
import { assetFailure, assetHeaders } from "@/lib/asset-response";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, context: Context) {
  try {
    requireSameOrigin(request); const actor = await requireMember(); await rateLimit(actor.id, "asset-chunk", 200);
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) throw new AssetError("Upload not found.", 404);
    const value = new URL(request.url).searchParams.get("part");
    const n = value !== null && /^\d+$/.test(value) ? Number(value) : -1;
    if (!Number.isSafeInteger(n) || n < 0 || Number(request.headers.get("content-length")) > UPLOAD_CHUNK_BYTES) throw new AssetError("Invalid upload chunk.");
    const data = Buffer.from(await request.arrayBuffer());
    if (!data.length || data.length > UPLOAD_CHUNK_BYTES) throw new AssetError("Upload chunks must be at most 1 MB.", 413);
    return await withAssetLock(actor.tenantId, async () => {
      await assetIndexes();
      const item = await Asset.findOne({ _id: id, tenantId: actor.tenantId, status: "uploading", createdBy: actor.email, expiresAt: { $gt: new Date() } });
      if (!item) throw new AssetError("Upload expired or is not owned by your account. Start again.", 404);
      const expected = Math.min(UPLOAD_CHUNK_BYTES, item.size - n * UPLOAD_CHUNK_BYTES);
      if (expected <= 0 || data.length !== expected) throw new AssetError("This upload chunk has an invalid size or position.");
      await parts().updateOne({ tenantId: actor.tenantId, assetId: item._id, n }, { $set: { data: new mongoose.mongo.Binary(data), expiresAt: item.expiresAt! } }, { upsert: true });
      return NextResponse.json({ received: n }, { headers: assetHeaders });
    });
  } catch (e) { return assetFailure(e); }
}
export async function POST(request: Request, context: Context) {
  try {
    requireSameOrigin(request); const actor = await requireMember(); await rateLimit(actor.id, "asset-finish", 15);
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) throw new AssetError("Upload not found.", 404);
    return await withAssetLock(actor.tenantId, async () => {
      const item = await Asset.findOne({ _id: id, tenantId: actor.tenantId, createdBy: actor.email });
      if (!item) throw new AssetError("Upload not found.", 404);
      if (item.status === "ready") return NextResponse.json(assetDTO(item), { headers: assetHeaders });
      if (!item.expiresAt || item.expiresAt < new Date()) throw new AssetError("This upload expired. Start again.", 409);
      const chunks = await parts().find({ tenantId: actor.tenantId, assetId: item._id }).sort({ n: 1 }).toArray();
      if (chunks.length !== Math.ceil(item.size / UPLOAD_CHUNK_BYTES) || chunks.some((c, i) => c.n !== i)) throw new AssetError("Upload is incomplete. Retry the missing chunks.", 409);
      const data = Buffer.concat(chunks.map(c => Buffer.from(c.data.value())));
      if (data.length !== item.size) throw new AssetError("Upload byte count does not match the selected file.");
      const updated = await persistFile(item, data);
      await AuditEvent.create({ tenantId: actor.tenantId, actor: actor.email, action: "asset.uploaded", target: item.id });
      return NextResponse.json(assetDTO(updated), { headers: assetHeaders });
    });
  } catch (e) { return assetFailure(e); }
}
