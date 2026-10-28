import { timingSafeEqual, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Delivery } from "@/lib/models/Delivery";
import { refreshDelivery } from "@/lib/publishing/delivery";
import { getPublishingProvider } from "@/lib/publishing/gateway";
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET, received = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret || ""}`;
  const supplied = Buffer.from(received), wanted = Buffer.from(expected);
  if (!secret || supplied.length !== wanted.length || !timingSafeEqual(supplied, wanted)) return new Response(null, { status: 401 });
  let release: (() => Promise<unknown>) | undefined;
  try {
    await dbConnect();
    const locks = mongoose.connection.db!.collection<{ _id: string; until: Date; token?: string }>("publishingchecks");
    try { await locks.updateOne({ _id: "i8is" }, { $setOnInsert: { until: new Date(0) } }, { upsert: true }); } catch (e) { if ((e as { code?: number }).code !== 11000) throw e; }
    const token = randomUUID();
    if (!await locks.findOneAndUpdate({ _id: "i8is", until: { $lt: new Date() } }, { $set: { token, until: new Date(Date.now() + 90000) } })) return NextResponse.json({ skipped: true });
    release = () => locks.updateOne({ _id: "i8is", token }, { $set: { until: new Date(0) }, $unset: { token: 1 } });
    const jobs = await Delivery.find({ tenantId: "i8is", state: { $in: ["queued", "submitting", "cancelling", "cancel_uncertain", "failed", "attention"] }, nextCheckAt: { $lte: new Date() } }).sort({ nextCheckAt: 1 }).limit(20);
    if (!jobs.length) return NextResponse.json({ checked: 0 });
    const provider = getPublishingProvider(), channels = (await provider.listChannels()).map(c => c.id);
    const results = await Promise.allSettled(jobs.map(async d => {
      try { await refreshDelivery(d, "system:daily-monitor", undefined, provider, channels); }
      catch {
        await Delivery.updateOne({ _id: d._id, state: d.state }, { $set: { error: "The latest Buffer check failed. Refresh manually or inspect Buffer; the saved status is the last confirmed result.", nextCheckAt: new Date(Date.now() + 3600000) } });
        throw new Error("Check unavailable");
      }
    }));
    return NextResponse.json({ checked: results.filter(r => r.status === "fulfilled").length, unavailable: results.filter(r => r.status === "rejected").length }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Publishing status check unavailable." }, { status: 503 }); }
  finally { await release?.(); }
}
