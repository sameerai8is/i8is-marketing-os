export interface PublishingChannel {
  id: string;
  name: string;
  platform: string;
  connected: boolean;
  locked: boolean;
  queuePaused: boolean;
}

export interface PublishingProvider {
  listChannels(): Promise<PublishingChannel[]>;
  createPost(input: ProviderPostInput): Promise<ProviderPost>;
  getPost(id: string): Promise<ProviderPost>;
  deletePost(id: string): Promise<void>;
}

export interface ProviderPostInput {
  channelId: string;
  text: string;
  mode: "shareNow" | "customScheduled";
  dueAt?: string;
  assets: { image: { url: string; metadata?: { altText: string } } }[];
  instagram?: boolean;
}
export interface ProviderPost {
  id: string;
  channelId: string;
  text: string;
  status: string;
  dueAt?: string;
  sentAt?: string;
  externalLink?: string;
  createdAt?: string;
  assetCount?: number;
}

export interface PublishingConnection {
  provider: "buffer";
  tenantId: "i8is";
  mode: "live";
  channels: PublishingChannel[];
  checkedAt: string;
}
