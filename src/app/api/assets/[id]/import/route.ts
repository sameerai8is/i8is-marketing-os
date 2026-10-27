import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { requireMember, requireSameOrigin } from "@/lib/authorization";
import { Asset } from "@/lib/models/Asset";
import { AuditEvent } from "@/lib/models/AuditEvent";
import { AssetError } from "@/lib/asset-policy";
import { withAssetLock } from "@/lib/asset-lock";
import { assetDTO, checkAssetCapacity, persistFile, resetDriveReference } from "@/lib/asset-storage";
import { downloadDriveFile } from "@/lib/drive-import";
import { assetFailure, assetHeaders } from "@/lib/asset-response";
import { rateLimit } from "@/lib/rate-limit";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request); const actor = await requireMember(); await rateLimit(actor.id, "asset-import", 5);
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) throw new AssetError("Drive reference not found.", 404);
    const original = await Asset.findOne({ _id: id, tenantId: actor.tenantId, status: "ready", kind: "link", source: "google_drive" });
    if (!original?.sourceUrl) throw new AssetError("Choose a saved Google Drive file reference.", 404);
    const file = await downloadDriveFile(original.sourceUrl);
    await requireMember();
    return await withAssetLock(actor.tenantId, async () => {
      await checkAssetCapacity(actor.tenantId, file.data.length, false);
      const item = await Asset.findOne({ _id: id, tenantId: actor.tenantId, kind: "link", updatedAt: original.updatedAt });
      if (!item) throw new AssetError("This Drive reference changed. Refresh before importing.", 409);
      item.storageId = new mongoose.Types.ObjectId(); item.filename = file.filename || item.name;
      item.size = file.data.length; item.status = "uploading"; item.expiresAt = new Date(Date.now() + 3600000); item.approval = "pending";
      await item.save();
      let updated;
      try { updated = await persistFile(item, file.data); }
      catch (e) { await resetDriveReference(item); throw e; }
      await AuditEvent.create({ tenantId: actor.tenantId, actor: actor.email, action: "asset.imported", target: id });
      return NextResponse.json(assetDTO(updated), { headers: assetHeaders });
    });
  } catch (e) { return assetFailure(e); }
}
