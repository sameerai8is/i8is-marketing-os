import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { requireMember, requireSameOrigin } from "@/lib/authorization";
import { Delivery } from "@/lib/models/Delivery";
import { AuditEvent } from "@/lib/models/AuditEvent";
import { rateLimit } from "@/lib/rate-limit";
import { DeliveryError } from "@/lib/publishing/policy";
import { deliveryDTO, dispatchDelivery, refreshDelivery, releaseDelivery } from "@/lib/publishing/delivery";
import { publishingFailure, publishingHeaders } from "@/lib/publishing/response";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request); const actor = await requireMember(true);
    await rateLimit(actor.id, "publishing-action", 12);
    const { id } = await context.params, body = await request.json();
    if (!mongoose.isValidObjectId(id)) throw new DeliveryError("Publishing request not found.", 404);
    const d = await Delivery.findOne({ _id: id, tenantId: actor.tenantId });
    if (!d) throw new DeliveryError("Publishing request not found.", 404);
    let result;
    if (body.action === "refresh") result = await refreshDelivery(d, actor.email);
    else if (body.action === "retry") result = await dispatchDelivery(d, actor);
    else if (body.action === "cancel") result = await releaseDelivery(d, actor);
    else if (body.action === "reconcile") {
      if (d.state !== "uncertain" || typeof body.providerId !== "string" || !/^[a-zA-Z0-9_-]{1,200}$/.test(body.providerId)) throw new DeliveryError("Only an unconfirmed send can be linked to a matching Buffer post ID.");
      result = await refreshDelivery(d, actor.email, body.providerId);
    } else throw new DeliveryError("Choose a supported publishing action.");
    await AuditEvent.create({ tenantId: actor.tenantId, actor: actor.email, action: `publishing.${body.action}`, target: id });
    return NextResponse.json(deliveryDTO(result), { headers: publishingHeaders });
  } catch (e) { return publishingFailure(e); }
}
