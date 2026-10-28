import { NextResponse } from "next/server";
import { accessErrorResponse } from "./authorization";
import { AssetError } from "./asset-policy";
import { ReviewError } from "./review-policy";
export const assetHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export function assetFailure(error: unknown) {
  if (error instanceof ReviewError) return NextResponse.json({ error: error.message }, { status: error.status, headers: assetHeaders });
  if (error instanceof AssetError || error instanceof SyntaxError) return NextResponse.json({ error: error instanceof AssetError ? error.message : "Invalid request." }, { status: error instanceof AssetError ? error.status : 400, headers: assetHeaders });
  return accessErrorResponse(error) || NextResponse.json({ error: "The asset library could not complete this action. Please retry." }, { status: 503, headers: assetHeaders });
}
