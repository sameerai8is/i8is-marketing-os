import { NextResponse } from "next/server";
import { requireMember } from "@/lib/authorization";
import { Delivery } from "@/lib/models/Delivery";
import { deliveryDTO } from "@/lib/publishing/delivery";
import { publishingFailure, publishingHeaders } from "@/lib/publishing/response";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const actor = await requireMember(), q = new URL(request.url).searchParams;
    const page = Math.max(1, Math.min(10000, Math.floor(Number(q.get("page")) || 1)));
    const filter = { tenantId: actor.tenantId, ...(q.get("post") ? { postId: q.get("post") } : {}) };
    const [items, count] = await Promise.all([Delivery.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 24).limit(24), Delivery.countDocuments(filter)]);
    return NextResponse.json({ items: items.map(deliveryDTO), count, page, admin: actor.role === "admin", dailyChecksConfigured: !!process.env.CRON_SECRET }, { headers: publishingHeaders });
  } catch (e) { return publishingFailure(e); }
}
