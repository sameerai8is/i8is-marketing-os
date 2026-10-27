import mongoose from "mongoose";
import { requireMember } from "@/lib/authorization";
import { Asset } from "@/lib/models/Asset";
import { AssetError } from "@/lib/asset-policy";
import { assetFailure, assetHeaders } from "@/lib/asset-response";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireMember(), { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) throw new AssetError("Preview not found.", 404);
    const item = await Asset.findOne({ _id: id, tenantId: actor.tenantId, status: "ready", kind: "image" }).select("+preview");
    if (!item?.preview) throw new AssetError("Preview not found.", 404);
    return new Response(new Uint8Array(item.preview), { headers: { ...assetHeaders, "Content-Type": "image/webp", "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch (e) { return assetFailure(e); }
}
