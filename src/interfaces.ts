import { UUID } from "crypto";
import { NatsConnection, JetStreamManager, JetStreamClient, StreamConfig, PubAck } from "nats";

export interface NatsContext {
  nc: NatsConnection;
  jsm: JetStreamManager;
  js: JetStreamClient;
}

export interface MessageEnvelope<T = unknown> {
  id: string;
  timestamp: number;
  subject: string;
  data: T;
}

export interface NatsConnectionOptions {
  url: string;
  token?: string;
}

export interface StreamOptions extends Partial<StreamConfig> {
  name: string;
  subjects: string[];
}
