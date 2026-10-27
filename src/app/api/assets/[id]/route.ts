import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { requireMember, requireSameOrigin } from "@/lib/authorization";
import { Asset } from "@/lib/models/Asset";
import { ContentItem } from "@/lib/models/ContentItem";
import { AuditEvent } from "@/lib/models/AuditEvent";
import { withAssetLock } from "@/lib/asset-lock";
import { assetFields, AssetError } from "@/lib/asset-policy";
import { assetDTO, removeAssetBytes } from "@/lib/asset-storage";
import { assetFailure, assetHeaders } from "@/lib/asset-response";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireMember(), { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) throw new AssetError("Asset not found.", 404);
    const asset = await Asset.findOne({ _id: id, tenantId: actor.tenantId, status: "ready" });
    if (!asset) throw new AssetError("Asset not found.", 404);
    return NextResponse.json(assetDTO(asset), { headers: assetHeaders });
  } catch (e) { return assetFailure(e); }
}
async function mutate(request: Request, context: Context, remove = false) {
  try {
    requireSameOrigin(request); const actor = await requireMember(); await rateLimit(actor.id, "asset-manage", 60);
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) throw new AssetError("Asset not found.", 404);
    return await withAssetLock(actor.tenantId, async () => {
      const item = await Asset.findOne({ _id: id, tenantId: actor.tenantId });
      if (!item) throw new AssetError("Asset not found.", 404);
      if (actor.role !== "admin" && item.createdBy !== actor.email) throw new AssetError("Only the owner or an administrator can change this asset.", 403);
      const body = await request.json();
      if (body?.updatedAt !== item.updatedAt.toISOString()) throw new AssetError("This asset changed. Refresh before saving.", 409);
      if (remove) {
        if (await ContentItem.exists({ tenantId: actor.tenantId, assetIds: id })) throw new AssetError("This asset is attached to a post. Remove it from the post before deleting it.", 409);
        await removeAssetBytes(item); await Asset.deleteOne({ _id: item._id, tenantId: actor.tenantId });
        await AuditEvent.create({ tenantId: actor.tenantId, actor: actor.email, action: "asset.deleted", target: id });
        return NextResponse.json({ message: "Asset removed." }, { headers: assetHeaders });
      }
      if (item.status !== "ready") throw new AssetError("Complete the upload before editing it.", 409);
      let values;
      if (body.action === "metadata") values = assetFields(body);
      else if (["approve", "unapprove"].includes(body.action)) {
        if (actor.role !== "admin") throw new AssetError("Only administrators can approve assets.", 403);
        if (body.action === "unapprove" && await ContentItem.exists({ tenantId: actor.tenantId, assetIds: id, status: { $ne: "draft" } })) throw new AssetError("Return linked posts to draft before removing this asset’s approval.", 409);
        values = { approval: body.action === "approve" ? "approved" : "pending" };
      } else throw new AssetError("Choose a supported asset action.");
      const updated = await Asset.findOneAndUpdate({ _id: item._id, tenantId: actor.tenantId, updatedAt: item.updatedAt }, { $set: values }, { new: true, runValidators: true });
      if (!updated) throw new AssetError("This asset changed. Refresh before saving.", 409);
      await AuditEvent.create({ tenantId: actor.tenantId, actor: actor.email, action: `asset.${body.action}`, target: id });
      return NextResponse.json(assetDTO(updated), { headers: assetHeaders });
    });
  } catch (e) { return assetFailure(e); }
}
export const PATCH = (r: Request, c: Context) => mutate(r, c);
export const DELETE = (r: Request, c: Context) => mutate(r, c, true);
