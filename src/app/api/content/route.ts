import dbConnect from "@/lib/mongodb";
import { ContentItem } from "@/lib/models/ContentItem";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unavailable() {
  return NextResponse.json(
    { error: "Content storage is unavailable. Configure MONGODB_URI with a reachable MongoDB database." },
    { status: 503 }
  );
}

export async function GET() {
  try {
    await dbConnect();
    const items = await ContentItem.find().sort({ scheduledAt: -1 }).limit(50);
    return NextResponse.json(items);
  } catch {
    return unavailable();
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Expected a content object" }, { status: 400 });
    }
    const candidate = new ContentItem(body);
    await candidate.validate();
    await dbConnect();
    const item = await candidate.save();
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {
      return NextResponse.json({ error: "Invalid content. Provide title, body, and a supported platform; check field values." }, { status: 400 });
    }
    return unavailable();
  }
}
