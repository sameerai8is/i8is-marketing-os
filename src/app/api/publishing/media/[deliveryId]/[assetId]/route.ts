import mongoose from "mongoose";
import { Readable } from "node:stream";
import dbConnect from "@/lib/mongodb";
import { Delivery } from "@/lib/models/Delivery";
import { Asset } from "@/lib/models/Asset";
import { assetBucket } from "@/lib/asset-storage";
import { verifyMediaSignature } from "@/lib/publishing/media";
import { AssetError, byteRange } from "@/lib/asset-policy";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'none'; sandbox" };
async function serve(request: Request, context: { params: Promise<{ deliveryId: string; assetId: string }> }, head = false) {
  try {
    const { deliveryId, assetId } = await context.params, q = new URL(request.url).searchParams;
    if (!mongoose.isValidObjectId(deliveryId) || !mongoose.isValidObjectId(assetId) || !verifyMediaSignature(deliveryId, assetId, q.get("expires"), q.get("signature"))) return new Response(null, { status: 404, headers });
    await dbConnect();
    const job = await Delivery.findOne({ _id: deliveryId, assetIds: assetId, state: { $nin: ["prepared", "rejected", "cancelled"] }, mediaExpiresAt: { $gt: new Date() } });
    if (!job || Math.floor(job.mediaExpiresAt.getTime() / 1000) !== Number(q.get("expires"))) return new Response(null, { status: 404, headers });
    const asset = await Asset.findOne({ _id: assetId, tenantId: job.tenantId, status: "ready", approval: "approved", kind: "image", mime: { $in: ["image/jpeg", "image/png"] } });
    if (!asset?.storageId) return new Response(null, { status: 404, headers });
    const range = byteRange(request.headers.get("range"), asset.size);
    const stream = head ? null : Readable.toWeb(assetBucket().openDownloadStream(asset.storageId, range ? { start: range.start, end: range.end + 1 } : {})) as ReadableStream<Uint8Array>;
    return new Response(stream, { status: range ? 206 : 200, headers: { ...headers, "Content-Type": asset.mime, "Content-Length": String(range ? range.end - range.start + 1 : asset.size), "Accept-Ranges": "bytes", ...(range ? { "Content-Range": `bytes ${range.start}-${range.end}/${asset.size}` } : {}) } });
  } catch (e) { return new Response(null, { status: e instanceof AssetError ? e.status : 503, headers }); }
}
export const GET = (r: Request, c: { params: Promise<{ deliveryId: string; assetId: string }> }) => serve(r, c);
export const HEAD = (r: Request, c: { params: Promise<{ deliveryId: string; assetId: string }> }) => serve(r, c, true);
