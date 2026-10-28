import { NextResponse } from "next/server";
import { accessErrorResponse } from "../authorization";
import { AssetError } from "../asset-policy";
import { DeliveryError } from "./policy";
import { PublishingError } from "./buffer";
export const publishingHeaders = { "Cache-Control": "private, no-store" };
export function publishingFailure(e: unknown) {
  if (e instanceof DeliveryError || e instanceof PublishingError || e instanceof AssetError) return NextResponse.json({ error: e.message }, { status: e.status, headers: publishingHeaders });
  if (e instanceof SyntaxError) return NextResponse.json({ error: "Invalid publishing request." }, { status: 400, headers: publishingHeaders });
  if ((e as { code?: number })?.code === 11000) return NextResponse.json({ error: "A publishing request already exists for this post or Buffer ID. Refresh the monitor." }, { status: 409, headers: publishingHeaders });
  return accessErrorResponse(e) || NextResponse.json({ error: "Publishing could not complete. Refresh the monitor before trying again." }, { status: 503, headers: publishingHeaders });
}
