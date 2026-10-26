import dbConnect from "@/lib/mongodb";
import { ContentItem } from "@/lib/models/ContentItem";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { accessErrorResponse, requireMember, requireSameOrigin } from "@/lib/authorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function logStorageFailure(error: unknown) {
  // Record diagnostic categories only. Raw MongoDB errors can contain URIs,
  // hostnames, credentials, and query details and must not be logged.
  const failure = error as {
    name?: string;
    code?: string | number;
    message?: string;
    reason?: { servers?: Map<string, { error?: { name?: string; code?: string | number } }> };
  } | null;
  const message = failure?.message || "";
  console.error("content.storage.unavailable", JSON.stringify({
    configured: Boolean(process.env.MONGODB_URI),
    type: failure?.name || "Unknown",
    code: failure?.code,
    authenticationFailure: /authentication|bad auth/i.test(message),
    networkAccessHint: /IP.*(?:whitelist|access list)|server selection|could not connect/i.test(message),
    serverErrors: failure?.reason?.servers instanceof Map
      ? Array.from(failure.reason.servers.values(), server => ({ type: server.error?.name, code: server.error?.code }))
      : undefined,
  }));
}

function unavailable() {
  return NextResponse.json(
    { error: "Content storage is unavailable. Configure MONGODB_URI with a reachable MongoDB database." },
    { status: 503 }
  );
}

export async function GET() {
  try {
    const member = await requireMember();
    await dbConnect();
    const items = await ContentItem.find({ tenantId: member.tenantId }).sort({ scheduledAt: -1 }).limit(50);
    return NextResponse.json(items, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    logStorageFailure(error);
    return unavailable();
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const member = await requireMember();
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Expected a content object" }, { status: 400 });
    }
    const candidate = new ContentItem({ ...body, tenantId: member.tenantId });
    await candidate.validate();
    await dbConnect();
    const item = await candidate.save();
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    if (error instanceof SyntaxError || error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {
      return NextResponse.json({ error: "Invalid content. Provide title, body, and a supported platform; check field values." }, { status: 400 });
    }
    logStorageFailure(error);
    return unavailable();
  }
}
