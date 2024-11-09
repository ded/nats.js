import { UUID } from "crypto";
import {
  NatsConnection,
  JetStreamManager,
  JetStreamClient,
  StreamConfig,
  PubAck,
} from "nats";

export interface NatsContext {
  nc: NatsConnection;
  jsm: JetStreamManager;
  js: JetStreamClient;
}
// TODO: Add more metadata fields if needed
export interface MessageEnvelope<T = unknown> {
  id: string;
  subject: string;
  data: T;
  created_at: Date;
  created_by?: string;
  metadata?: Record<string, unknown>;
}

export interface NatsConnectionOptions {
  url: string;
  user?: string;
  pass?: string;
}

export interface StreamOptions extends Partial<StreamConfig> {
  name: string;
  subjects: string[];
}
