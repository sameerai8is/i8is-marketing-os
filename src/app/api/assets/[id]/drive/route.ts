import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireMember, requireSameOrigin } from "@/lib/authorization";
import { copyFileToDrive } from "@/lib/google-drive";
import { AssetError } from "@/lib/asset-policy";
import { Asset } from "@/lib/models/Asset";
import { AuditEvent } from "@/lib/models/AuditEvent";
import { withAssetLock } from "@/lib/asset-lock";
import { assetBucket } from "@/lib/asset-storage";
import { assetFailure, assetHeaders } from "@/lib/asset-response";
import { rateLimit } from "@/lib/rate-limit";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request); const a = await requireMember(); await rateLimit(a.id, "drive-copy", 10);
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) throw new AssetError("Asset not found.", 404);
    return await withAssetLock(`${a.tenantId}:drive:${id}:${a.id}`, async () => {
      const item = await Asset.findOne({ _id: id, tenantId: a.tenantId, status: "ready" });
      if (!item?.storageId) throw new AssetError("Choose an uploaded or imported file.", 404);
      if (a.role !== "admin" && item.createdBy !== a.email) throw new AssetError("Only the uploader or an administrator can save a Drive copy.", 403);
      if (item.driveBackupId && item.driveBackupBy === a.email) return NextResponse.json({ url: `https://drive.google.com/file/d/${item.driveBackupId}/view` }, { headers: assetHeaders });
      const chunks: Buffer[] = [];
      for await (const chunk of assetBucket().openDownloadStream(item.storageId)) chunks.push(Buffer.from(chunk));
      const file = await copyFileToDrive(a, { data: Buffer.concat(chunks), name: item.filename || item.name, mime: item.mime, assetId: id });
      await requireMember();
      await Asset.updateOne({ _id: id, tenantId: a.tenantId }, { $set: { driveBackupId: file.id, driveBackupBy: a.email } });
      await AuditEvent.create({ tenantId: a.tenantId, actor: a.email, action: "asset.drive_copied", target: id });
      return NextResponse.json({ url: `https://drive.google.com/file/d/${file.id}/view` }, { headers: assetHeaders });
    });
  } catch (e) { return assetFailure(e); }
}
