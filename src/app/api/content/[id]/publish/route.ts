import { NextResponse } from "next/server";
import { requireMember, requireSameOrigin } from "@/lib/authorization";
import { rateLimit } from "@/lib/rate-limit";
import { createDelivery, deliveryDTO } from "@/lib/publishing/delivery";
import { publishingFailure, publishingHeaders } from "@/lib/publishing/response";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request); const actor = await requireMember(true);
    await rateLimit(actor.id, "publishing-submit", 6);
    const { id } = await context.params, body = await request.json();
    return NextResponse.json(deliveryDTO(await createDelivery(actor, id, body)), { status: 201, headers: publishingHeaders });
  } catch (e) { return publishingFailure(e); }
}
