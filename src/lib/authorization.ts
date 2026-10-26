import "server-only";
import { auth, authConfigured } from "@/auth";
import dbConnect from "./mongodb";
import { WorkspaceMember } from "./models/WorkspaceMember";
import { isSameOrigin, normalizeEmail, WORKSPACE_ID } from "./access-policy";
import { NextResponse } from "next/server";

export class AccessError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) { super(code); this.status = status; this.code = code; }
}

export async function requireMember(adminOnly = false) {
  if (!authConfigured()) throw new AccessError(503, "AUTH_NOT_CONFIGURED");
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);
  if (!email || !session?.user?.id) throw new AccessError(401, "SIGN_IN_REQUIRED");
  try {
    await dbConnect();
    // Check live membership on every protected request so revocation takes
    // effect without waiting for the JWT to expire.
    const member = await WorkspaceMember.findOne({ tenantId: WORKSPACE_ID, email, googleSubject: session.user.id, status: "active" });
    if (!member || (adminOnly && member.role !== "admin")) throw new AccessError(403, "ACCESS_DENIED");
    return { id: member.id as string, tenantId: WORKSPACE_ID, email: member.email, name: member.name, role: member.role };
  } catch (error) {
    if (error instanceof AccessError) throw error;
    throw new AccessError(503, "STORAGE_UNAVAILABLE");
  }
}

export function accessErrorResponse(error: unknown) {
  if (!(error instanceof AccessError)) return null;
  return NextResponse.json({ error: error.code, code: error.code }, { status: error.status, headers: { "Cache-Control": "private, no-store" } });
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  // Next's Node server can normalize request.url to localhost. Match the
  // browser-facing Host and the reverse proxy's protocol instead.
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || new URL(request.url).protocol.slice(0, -1);
  if (!isSameOrigin(origin, request.headers.get("host"), protocol)) throw new AccessError(403, "INVALID_ORIGIN");
}
