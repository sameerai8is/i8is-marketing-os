import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireMember, requireSameOrigin } from "@/lib/authorization";
import { downloadConnectedDriveFile } from "@/lib/google-drive";
import { assetFields, AssetError } from "@/lib/asset-policy";
import { Asset } from "@/lib/models/Asset";
import { AuditEvent } from "@/lib/models/AuditEvent";
import { withAssetLock } from "@/lib/asset-lock";
import { assetDTO, assetIndexes, checkAssetCapacity, persistFile, removeAssetBytes } from "@/lib/asset-storage";
import { assetFailure, assetHeaders } from "@/lib/asset-response";
import { rateLimit } from "@/lib/rate-limit";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    requireSameOrigin(request); const a = await requireMember(); await rateLimit(a.id, "drive-import", 10);
    const b = await request.json();
    if (!b || typeof b.fileId !== "string") throw new AssetError("Choose a Drive file.");
    const file = await downloadConnectedDriveFile(a, b.fileId), fields = assetFields({ ...b, name: file.name });
    await requireMember();
    return await withAssetLock(a.tenantId, async () => {
      await assetIndexes(); await checkAssetCapacity(a.tenantId, file.data.length);
      const item = await Asset.create({ ...fields, tenantId: a.tenantId, source: "google_drive", sourceUrl: file.sourceUrl, driveId: b.fileId, filename: file.filename, kind: "source", status: "uploading", size: file.data.length, storageId: new mongoose.Types.ObjectId(), createdBy: a.email, expiresAt: new Date(Date.now() + 3600000) });
      let saved;
      try { saved = await persistFile(item, file.data); }
      catch (e) { await removeAssetBytes(item); await Asset.deleteOne({ _id: item._id, tenantId: a.tenantId }); throw e; }
      await AuditEvent.create({ tenantId: a.tenantId, actor: a.email, action: "asset.drive_imported", target: item.id });
      return NextResponse.json(assetDTO(saved), { status: 201, headers: assetHeaders });
    });
  } catch (e) { return assetFailure(e); }
}
