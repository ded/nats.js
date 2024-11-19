import {
  NatsConnection,
  JetStreamManager,
  JetStreamClient,
  StreamConfig,
  PubAck,
} from "nats";
/**
 * @description Nats context for publishing and consuming messages
 * @nc - The nats connection
 * @jsm - The jetstream manager
 * @js - The jetstream client
 */
export interface NatsContext {
  nc: NatsConnection;
  jsm: JetStreamManager;
  js: JetStreamClient;
}

/**
 * @description Message envelope for publishing and consuming messages
 * @template T - The type of the data in the message
 * @id - The id of the message and should be a UUID
 * @subject - The subject of the message
 * @data - The data of the message
 * @createdAt - The date the message was created
 * @createdBy - The user that created the message
 * @metadata - optional additional metadata for the message
 */
export interface MessageEnvelope<T = unknown> {
  id: string;
  subject: string;
  data: T;
  createdAt: Date;
  createdBy: string;
  metadata?: Record<string, unknown>;
}

/**
 * @description Nats connection options
 * @url - The url of the nats server
 * @user - The user of the nats server
 * @pass - The password of the nats server
 */
export interface NatsConnectionOptions {
  url: string;
  user?: string;
  pass?: string;
}

/**
 * @description Stream options for creating a stream
 * @name - The name of the stream
 * @subjects - The subjects of the stream
 */
export interface StreamOptions extends Partial<StreamConfig> {
  name: string;
  subjects: string[];
}

/**
 * @description Publish options for publishing a message
 * @template T - The type of the data in the message
 * @js - The jetstream client
 * @nc - The nats connection
 * @streamName - The name of the stream e.g. "EVENTS"
 * @messageEnvelope - The message envelope
 */
export interface PublishOptions<T> {
  js: JetStreamClient;
  nc: NatsConnection;
  streamName: string;
  messageEnvelope: MessageEnvelope<T>;
}
