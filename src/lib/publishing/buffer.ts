import type { PublishingChannel, PublishingProvider, ProviderPost, ProviderPostInput } from "./types";

export class PublishingError extends Error {
  readonly code: string;
  readonly status: number;
  readonly uncertain: boolean;
  constructor(code: string, message: string, status = 502, uncertain = false) {
    super(message);
    this.name = "PublishingError";
    this.code = code;
    this.status = status;
    this.uncertain = uncertain;
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

  private async operation(query: string, variables: object, mutation = false): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await this.request("https://api.buffer.com", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        cache: "no-store", signal: AbortSignal.timeout(20000), body: JSON.stringify({ query, variables }),
      });
    } catch { throw new PublishingError("BUFFER_UNAVAILABLE", mutation ? "Buffer did not confirm the request. Check Buffer before taking further action." : "Buffer could not be reached. Try again shortly.", 503, mutation); }
    if ([401, 403, 429].includes(response.status)) throw new PublishingError(response.status === 429 ? "BUFFER_RATE_LIMIT" : "BUFFER_AUTH", response.status === 429 ? "Buffer's request limit was reached. Wait before retrying." : "Buffer denied access. Check the server key and permissions.", 503);
    if (!response.ok) throw new PublishingError("BUFFER_UPSTREAM", "Buffer returned an unexpected response. Check its dashboard.", 502, mutation);
    let body;
    try { body = await response.json(); } catch { throw new PublishingError("BUFFER_RESPONSE", "Buffer returned an unreadable response. Check its dashboard.", 502, mutation); }
    // GraphQL may include partial mutation data. Do not assume it is safe to repeat.
    if (!body?.data || body.errors?.length) throw new PublishingError("BUFFER_QUERY", "Buffer could not confirm this operation. Check its dashboard.", 502, mutation);
    return body.data;
  }

  private post(value: unknown): ProviderPost {
    const p = value as Record<string, unknown> | undefined;
    if (!p || typeof p.id !== "string" || typeof p.channelId !== "string" || typeof p.status !== "string" || typeof p.text !== "string") throw new PublishingError("BUFFER_RESPONSE", "Buffer returned incomplete post information.", 502, true);
    const date = (v: unknown) => typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : undefined;
    let externalLink: string | undefined;
    try { if (typeof p.externalLink === "string" && new URL(p.externalLink).protocol === "https:") externalLink = p.externalLink; } catch { /* Do not render untrusted links. */ }
    return { id: p.id, channelId: p.channelId, text: p.text, status: p.status, dueAt: date(p.dueAt), sentAt: date(p.sentAt), externalLink, createdAt: date(p.createdAt), assetCount: Array.isArray(p.assets) ? p.assets.length : undefined };
  }

  async createPost(input: ProviderPostInput): Promise<ProviderPost> {
    const data = await this.operation(`mutation OrbitPublish($input: CreatePostInput!) { createPost(input: $input) { __typename ... on PostActionSuccess { post { id channelId text status dueAt sentAt externalLink createdAt assets { id } } } ... on MutationError { message } } }`, { input: {
      channelId: input.channelId, text: input.text, mode: input.mode, schedulingType: "automatic", assets: input.assets,
      needsApproval: false, saveToDraft: false, source: "Orbit by I8IS", ...(input.dueAt ? { dueAt: input.dueAt } : {}),
      ...(input.instagram ? { metadata: { instagram: { type: "post", shouldShareToFeed: true } } } : {}),
    } }, true);
    const result = data.createPost as { __typename?: string; post?: unknown; message?: unknown } | undefined;
    if (result?.post) return this.post(result.post);
    if (typeof result?.message === "string") throw new PublishingError("BUFFER_REJECTED", "Buffer rejected this post. Check profile permissions, text limits, image dimensions and posting limits before retrying.", 422);
    throw new PublishingError("BUFFER_RESPONSE", "Buffer did not confirm post creation. Check its dashboard.", 502, true);
  }

  async getPost(id: string): Promise<ProviderPost> {
    const data = await this.operation(`query OrbitPost($input: PostInput!) { post(input: $input) { id channelId text status dueAt sentAt externalLink createdAt assets { id } } }`, { input: { id } });
    return this.post(data.post);
  }

  async deletePost(id: string): Promise<void> {
    const data = await this.operation(`mutation OrbitCancel($input: DeletePostInput!) { deletePost(input: $input) { __typename ... on DeletePostSuccess { id } ... on MutationError { message } } }`, { input: { id } }, true);
    const result = data.deletePost as { id?: string; message?: unknown } | undefined;
    if (result?.id === id) return;
    if (typeof result?.message === "string") throw new PublishingError("BUFFER_REJECTED", "Buffer did not cancel this post. Check its current state in Buffer.", 422);
    throw new PublishingError("BUFFER_RESPONSE", "Cancellation was not confirmed. Check Buffer before trying again.", 502, true);
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
