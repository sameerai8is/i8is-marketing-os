import mongoose from "mongoose";
import { Readable } from "node:stream";
import { requireMember } from "@/lib/authorization";
import { Asset } from "@/lib/models/Asset";
import { AssetError, byteRange } from "@/lib/asset-policy";
import { assetBucket } from "@/lib/asset-storage";
import { assetFailure, assetHeaders } from "@/lib/asset-response";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireMember(), { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) throw new AssetError("File not found.", 404);
    const item = await Asset.findOne({ _id: id, tenantId: actor.tenantId, status: "ready", kind: { $ne: "link" } });
    if (!item?.storageId) throw new AssetError("File not found.", 404);
    const range = byteRange(request.headers.get("range"), item.size);
    const download = new URL(request.url).searchParams.get("download") === "1" || !["image", "video"].includes(item.kind);
    const stream = assetBucket().openDownloadStream(item.storageId, range ? { start: range.start, end: range.end + 1 } : {});
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { status: range ? 206 : 200, headers: {
      ...assetHeaders, "Content-Type": item.kind === "source" ? "application/octet-stream" : item.mime,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(item.filename || item.name)}`,
      "Accept-Ranges": "bytes", "Content-Security-Policy": "default-src 'none'; sandbox",
      ...(range ? { "Content-Range": `bytes ${range.start}-${range.end}/${item.size}`, "Content-Length": String(range.end - range.start + 1) } : {}),
    } });
  } catch (e) { return assetFailure(e); }
}
