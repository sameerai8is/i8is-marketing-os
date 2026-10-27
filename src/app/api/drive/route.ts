import { NextResponse } from "next/server";
import { requireMember, requireSameOrigin } from "@/lib/authorization";
import { driveStatus, listDriveFiles } from "@/lib/google-drive";
import { DriveConnection } from "@/lib/models/DriveConnection";
import { assetFailure, assetHeaders } from "@/lib/asset-response";
import { rateLimit } from "@/lib/rate-limit";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const a = await requireMember(), url = new URL(request.url);
    if (url.searchParams.get("list") !== "1") return NextResponse.json(await driveStatus(a), { headers: assetHeaders });
    await rateLimit(a.id, "drive-list", 60);
    return NextResponse.json(await listDriveFiles(a, url.searchParams.get("parent") || "root", url.searchParams.get("q") || "", url.searchParams.get("pageToken") || ""), { headers: assetHeaders });
  } catch (e) { return assetFailure(e); }
}
export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request); const a = await requireMember();
    await DriveConnection.deleteMany({ tenantId: a.tenantId, email: a.email });
    return NextResponse.json({ disconnected: true }, { headers: assetHeaders });
  } catch (e) { return assetFailure(e); }
}
