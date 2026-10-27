import "server-only";
import mongoose from "mongoose";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import { createHash } from "node:crypto";
import { Asset, type IAsset } from "./models/Asset";
import { AssetError, MAX_ASSET_BYTES, UPLOAD_CHUNK_BYTES, WORKSPACE_ASSET_BYTES } from "./asset-policy";

export function assetBucket() { return new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: "assetfiles" }); }
export function parts() { return mongoose.connection.db!.collection<{ tenantId: string; assetId: mongoose.Types.ObjectId; n: number; data: mongoose.mongo.Binary; expiresAt: Date }>("assetparts"); }
let indexes: Promise<unknown> | undefined;
export async function assetIndexes() {
  indexes ||= Promise.all([Asset.init(), parts().createIndex({ tenantId: 1, assetId: 1, n: 1 }, { unique: true }), parts().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })]).catch(e => { indexes = undefined; throw e; });
  await indexes;
}
export async function removeAssetBytes(asset: Pick<IAsset, "_id" | "tenantId" | "storageId">) {
  await parts().deleteMany({ tenantId: asset.tenantId, assetId: asset._id });
  if (asset.storageId) {
    await mongoose.connection.db!.collection("assetfiles.files").deleteOne({ _id: asset.storageId, "metadata.tenantId": asset.tenantId });
    await mongoose.connection.db!.collection("assetfiles.chunks").deleteMany({ files_id: asset.storageId });
  }
}
export async function cleanupUploads(tenantId: string) {
  const expired = await Asset.find({ tenantId, status: "uploading", expiresAt: { $lt: new Date() } }).limit(100);
  for (const asset of expired) { await removeAssetBytes(asset); if (asset.source === "google_drive") await resetDriveReference(asset); else await Asset.deleteOne({ _id: asset._id, tenantId, status: "uploading" }); }
}
export async function resetDriveReference(asset: IAsset) {
  await Asset.updateOne({ _id: asset._id, tenantId: asset.tenantId }, { $set: { kind: "link", status: "ready", size: 0, mime: "application/octet-stream", filename: "", approval: "pending" }, $unset: { storageId: 1, expiresAt: 1, preview: 1, width: 1, height: 1, checksum: 1 } });
}
export async function checkAssetCapacity(tenantId: string, bytes: number, extraRecord = true) {
  await cleanupUploads(tenantId);
  const usage = await Asset.aggregate<{ _id: null; bytes: number; count: number }>([{ $match: { tenantId } }, { $group: { _id: null, bytes: { $sum: "$size" }, count: { $sum: 1 } } }]);
  if ((usage[0]?.bytes || 0) + bytes > WORKSPACE_ASSET_BYTES) throw new AssetError("The workspace’s 100 MB asset allowance is full. Remove unused files before uploading.", 413);
  if (extraRecord && (usage[0]?.count || 0) >= 1000) throw new AssetError("This workspace has reached 1,000 assets. Remove unused entries first.", 413);
}
export function assetDTO(a: IAsset) {
  return { id: String(a._id), name: a.name, filename: a.filename, folder: a.folder, tags: a.tags, altText: a.altText, kind: a.kind, source: a.source, sourceUrl: a.sourceUrl, driveFolder: a.driveFolder, driveNative: a.driveNative, status: a.status, approval: a.approval, createdBy: a.createdBy, size: a.size, mime: a.mime, width: a.width, height: a.height, updatedAt: a.updatedAt, createdAt: a.createdAt, previewUrl: a.kind === "image" && a.status === "ready" ? `/api/assets/${a._id}/preview` : undefined, fileUrl: a.kind !== "link" && a.status === "ready" ? `/api/assets/${a._id}/file` : undefined };
}
export async function inspectFile(data: Buffer, filename: string) {
  if (!data.length || data.length > MAX_ASSET_BYTES) throw new AssetError("Files must be between 1 byte and 25 MB.", 413);
  const detected = await fileTypeFromBuffer(data).catch(() => undefined);
  if (!detected && /\.svg$/i.test(filename) && /<svg[\s>]/i.test(data.subarray(0, 4096).toString("utf8"))) return { mime: "image/svg+xml", kind: "source" as const };
  if (!detected) throw new AssetError("File format could not be verified. Upload an image, PDF, MP4/WebM, font, SVG source, or ZIP pack.");
  const { mime } = detected;
  if (["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"].includes(mime)) {
    try {
      const image = sharp(data, { limitInputPixels: 40000000, animated: false });
      const metadata = await image.metadata();
      if (!metadata.width || !metadata.height || metadata.width * metadata.height > 40000000) throw new Error();
      const preview = await image.rotate().resize(640, 640, { fit: "inside", withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
      return { mime, kind: "image" as const, width: metadata.width, height: metadata.height, preview };
    } catch { throw new AssetError("This image could not be previewed. Use a valid image up to 40 megapixels."); }
  }
  if (["video/mp4", "video/webm"].includes(mime)) return { mime, kind: "video" as const };
  if (mime === "application/pdf") return { mime, kind: "document" as const };
  if (["application/zip", "font/woff", "font/woff2", "font/ttf", "font/otf", "application/font-sfnt", "application/vnd.ms-opentype"].includes(mime)) return { mime, kind: "source" as const };
  throw new AssetError("This format is not supported. Use PNG, JPG, WebP, GIF, AVIF, PDF, MP4, WebM, SVG, a font, or ZIP.");
}
export async function persistFile(asset: IAsset, data: Buffer) {
  const inspected = await inspectFile(data, asset.filename || asset.name);
  const storageId = asset.storageId || new mongoose.Types.ObjectId();
  const bucket = assetBucket();
  try {
    // Remove bytes left by a prior interrupted completion of this same upload.
    await removeAssetBytes({ _id: asset._id, tenantId: asset.tenantId, storageId });
    const stream = bucket.openUploadStreamWithId(storageId, asset.filename || asset.name, { chunkSizeBytes: UPLOAD_CHUNK_BYTES, metadata: { tenantId: asset.tenantId, assetId: asset._id, mime: inspected.mime } });
    await new Promise<void>((resolve, reject) => { stream.once("error", reject); stream.once("finish", resolve); stream.end(data); });
    const updated = await Asset.findOneAndUpdate({ _id: asset._id, tenantId: asset.tenantId }, { $set: { ...inspected, storageId, size: data.length, checksum: createHash("sha256").update(data).digest("hex"), status: "ready", approval: "pending" }, $unset: { expiresAt: 1 } }, { new: true, runValidators: true });
    if (!updated) throw new AssetError("This upload was removed. Please try again.", 409);
    return updated;
  } catch (e) { await removeAssetBytes({ _id: asset._id, tenantId: asset.tenantId, storageId }); throw e; }
}
export async function validateAssetReferences(tenantId: string, ids: string[], approved = false) {
  if (!ids.length) return;
  const assets = await Asset.find({ tenantId, _id: { $in: ids }, status: "ready", kind: { $in: ["image", "video", "document"] } });
  if (assets.length !== ids.length) throw new AssetError("One of these assets is unavailable or cannot be attached. Import Drive files or upload a supported image, video, or PDF first.");
  if (approved && assets.some(a => a.approval !== "approved")) throw new AssetError("All attached assets need administrator approval in Assets before this post can move forward.");
}
export async function postsWithAssets(items: object[], tenantId: string) {
  const records: Array<{ assetIds?: string[]; [key: string]: unknown }> = JSON.parse(JSON.stringify(items));
  const ids = [...new Set(records.flatMap(p => p.assetIds || []))];
  if (!ids.length) return records.map(p => ({ ...p, attachments: [] }));
  const assets = await Asset.find({ tenantId, _id: { $in: ids }, status: "ready" });
  const map = new Map(assets.map(a => [String(a._id), assetDTO(a)]));
  return records.map(p => ({ ...p, attachments: (p.assetIds || []).map(id => map.get(String(id))).filter(Boolean) }));
}
