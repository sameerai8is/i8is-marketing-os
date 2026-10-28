import "server-only";
import { BufferProvider, PublishingError } from "./buffer";
import type { PublishingConnection } from "./types";

// Server-owned binding for the I8IS-only prototype. Never accept tenant or
// organization IDs from a request. Replace with authenticated tenant lookup
// before supporting additional tenants.
export function getPublishingProvider() {
  const apiKey = process.env.BUFFER_API_KEY?.trim();
  const organizationId = process.env.BUFFER_ORGANIZATION_ID?.trim();
  if (!apiKey || !organizationId) {
    throw new PublishingError("BUFFER_NOT_CONFIGURED", "Configure BUFFER_API_KEY and BUFFER_ORGANIZATION_ID on the server to connect I8IS's profiles.", 503);
  }
  return new BufferProvider(apiKey, organizationId);
}
export async function getPublishingConnection(): Promise<PublishingConnection> {
  const provider = getPublishingProvider();
  return {
    provider: "buffer",
    tenantId: "i8is",
    mode: "live",
    channels: await provider.listChannels(),
    checkedAt: new Date().toISOString(),
  };
}
