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
}

export interface PublishingConnection {
  provider: "buffer";
  tenantId: "i8is";
  mode: "simulation";
  channels: PublishingChannel[];
  checkedAt: string;
}
