import { NextResponse } from "next/server";
import { getPublishingConnection } from "@/lib/publishing/gateway";
import { PublishingError } from "@/lib/publishing/buffer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    return NextResponse.json(await getPublishingConnection(), { headers });
  } catch (error) {
    if (error instanceof PublishingError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers });
    }
    return NextResponse.json({ error: "Unable to check the publishing connection.", code: "PUBLISHING_ERROR" }, { status: 500, headers });
  }
}
