import type { PublishingChannel, PublishingProvider } from "./types";

export class PublishingError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 502) {
    super(message);
    this.name = "PublishingError";
    this.code = code;
    this.status = status;
  }
}

interface BufferChannel {
  id: string;
  name: string;
  displayName: string | null;
  service: string;
  isDisconnected: boolean;
  isLocked: boolean;
  isQueuePaused: boolean;
}

export class BufferProvider implements PublishingProvider {
  private readonly apiKey: string;
  private readonly organizationId: string;
  private readonly request: typeof fetch;
  constructor(
    apiKey: string,
    organizationId: string,
    request: typeof fetch = fetch,
  ) {
    this.apiKey = apiKey;
    this.organizationId = organizationId;
    this.request = request;
  }

  async listChannels(): Promise<PublishingChannel[]> {
    let response: Response;
    try {
      response = await this.request("https://api.buffer.com", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          query: `query MarketingChannels($input: ChannelsInput!) {
            channels(input: $input) {
              id name displayName service isDisconnected isLocked isQueuePaused
            }
          }`,
          variables: { input: { organizationId: this.organizationId } },
        }),
      });
    } catch {
      throw new PublishingError("BUFFER_UNAVAILABLE", "Buffer could not be reached. Try again shortly.", 503);
    }
    if (response.status === 401 || response.status === 403) {
      throw new PublishingError("BUFFER_AUTH", "Buffer denied access. Check the API key and organization permissions.", 503);
    }
    if (response.status === 429) {
      throw new PublishingError("BUFFER_RATE_LIMIT", "Buffer's request limit was reached. Try again later.", 503);
    }
    if (!response.ok) {
      throw new PublishingError("BUFFER_UPSTREAM", "Buffer returned an unexpected response. Try again shortly.");
    }
    let body: { data?: { channels?: BufferChannel[] }; errors?: unknown[] };
    try {
      body = await response.json();
    } catch {
      throw new PublishingError("BUFFER_RESPONSE", "Buffer returned an unreadable response.");
    }
    if (!body || body.errors?.length || !Array.isArray(body.data?.channels)) {
      // Never forward upstream messages, which may contain account details.
      throw new PublishingError("BUFFER_QUERY", "Buffer could not list profiles. Check the organization permissions.");
    }
    return body.data.channels.map((channel) => {
      if (!channel || typeof channel.id !== "string" || typeof channel.name !== "string" ||
          typeof channel.service !== "string" || typeof channel.isDisconnected !== "boolean" ||
          typeof channel.isLocked !== "boolean" || typeof channel.isQueuePaused !== "boolean") {
        throw new PublishingError("BUFFER_RESPONSE", "Buffer returned incomplete profile information.");
      }
      return {
        id: channel.id,
        name: channel.displayName || channel.name,
        platform: channel.service,
        connected: !channel.isDisconnected,
        locked: channel.isLocked,
        queuePaused: channel.isQueuePaused,
      };
    });
  }
}
