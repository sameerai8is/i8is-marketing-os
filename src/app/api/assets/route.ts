import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { requireMember, requireSameOrigin } from "@/lib/authorization";
import { Asset } from "@/lib/models/Asset";
import { AuditEvent } from "@/lib/models/AuditEvent";
import { rateLimit } from "@/lib/rate-limit";
import { withAssetLock } from "@/lib/asset-lock";
import { assetFields, AssetError, driveLink, MAX_ASSET_BYTES, UPLOAD_CHUNK_BYTES, WORKSPACE_ASSET_BYTES } from "@/lib/asset-policy";
import { assetIndexes, checkAssetCapacity, assetDTO } from "@/lib/asset-storage";
import { assetFailure, assetHeaders } from "@/lib/asset-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const actor = await requireMember(), url = new URL(request.url);
    const page = Math.max(1, Math.min(10000, Math.floor(Number(url.searchParams.get("page")) || 1)));
    const q = (url.searchParams.get("q") || "").trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const kind = url.searchParams.get("kind"), source = url.searchParams.get("source"), approval = url.searchParams.get("approval"), folder = url.searchParams.get("folder");
    const filter = { tenantId: actor.tenantId, status: "ready", ...(q ? { $or: [{ name: { $regex: q, $options: "i" } }, { tags: { $regex: q, $options: "i" } }] } : {}), ...(url.searchParams.get("attachable") === "1" ? { kind: { $in: ["image", "video", "document"] } } : ["image", "video", "document", "source", "link"].includes(kind || "") ? { kind } : {}), ...(["upload", "google_drive"].includes(source || "") ? { source } : {}), ...(["approved", "pending"].includes(approval || "") ? { approval } : {}), ...(folder !== null ? { folder: folder.slice(0, 80) } : {}) };
    const [items, total, folders, usage] = await Promise.all([
      Asset.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 24).limit(24), Asset.countDocuments(filter),
      Asset.distinct("folder", { tenantId: actor.tenantId, status: "ready" }),
      Asset.aggregate<{ _id: null; size: number }>([{ $match: { tenantId: actor.tenantId } }, { $group: { _id: null, size: { $sum: "$size" } } }]),
    ]);
    return NextResponse.json({ items: items.map(assetDTO), page, pages: Math.max(1, Math.ceil(total / 24)), total, folders: folders.filter(Boolean).sort(), usedBytes: usage[0]?.size || 0, quotaBytes: WORKSPACE_ASSET_BYTES, maxFileBytes: MAX_ASSET_BYTES, actorEmail: actor.email, admin: actor.role === "admin" }, { headers: assetHeaders });
  } catch (e) { return assetFailure(e); }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const actor = await requireMember(); await rateLimit(actor.id, "asset-create", 15);
    const body = await request.json(), fields = assetFields(body);
    return await withAssetLock(actor.tenantId, async () => {
      await assetIndexes();
      if (body.action === "drive") {
        const drive = driveLink(body.url); await checkAssetCapacity(actor.tenantId, 0);
        const item = await Asset.create({ ...fields, tenantId: actor.tenantId, filename: "", source: "google_drive", sourceUrl: drive.url, driveId: drive.id, driveFolder: drive.folder, driveNative: drive.native, kind: "link", status: "ready", createdBy: actor.email, size: 0 });
        await AuditEvent.create({ tenantId: actor.tenantId, actor: actor.email, action: "asset.linked", target: item.id });
        return NextResponse.json(assetDTO(item), { status: 201, headers: assetHeaders });
      }
      if (body.action !== "upload" || !Number.isSafeInteger(body.size) || body.size < 1 || body.size > MAX_ASSET_BYTES || typeof body.filename !== "string" || !body.filename.trim() || body.filename.length > 250) throw new AssetError("Choose a file up to 25 MB with a valid filename.", 400);
      await checkAssetCapacity(actor.tenantId, body.size);
      const item = await Asset.create({ ...fields, tenantId: actor.tenantId, filename: body.filename.replace(/[\x00-\x1f/\\]/g, "_"), kind: "source", source: "upload", status: "uploading", storageId: new mongoose.Types.ObjectId(), createdBy: actor.email, size: body.size, expiresAt: new Date(Date.now() + 3600000) });
      return NextResponse.json({ ...assetDTO(item), chunkSize: UPLOAD_CHUNK_BYTES, chunks: Math.ceil(body.size / UPLOAD_CHUNK_BYTES) }, { status: 201, headers: assetHeaders });
    });
  } catch (e) { return assetFailure(e); }
}
