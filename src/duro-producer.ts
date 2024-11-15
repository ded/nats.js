import { PubAck, JetStreamClient, NatsConnection } from "nats";
import { MessageEnvelope } from "./interfaces";
import { v4 as uuidv4 } from "uuid";
import { checkSubject } from "./utils";

export interface PublishOptions<T> {
  js: JetStreamClient;
  nc: NatsConnection;
  streamName: string;
  messageEnvelope: MessageEnvelope<T>;
}

export async function publish<T>(
  publishOptions: PublishOptions<T>
): Promise<PubAck> {
  const { js, nc, streamName, messageEnvelope } = publishOptions;
  const { subject, data } = messageEnvelope;
  if (!js) throw new Error("JetStream client not established");
  if (!messageEnvelope) throw new Error("Message envelope is required");
  if (!subject) throw new Error("Subject is required");
  if (!data) throw new Error("Data is required");
  if (!streamName) throw new Error("Stream name is required");
  const subjectExists = await checkSubject(nc, streamName, subject);
  if (!subjectExists)
    throw new Error(
      `Subject ${subject} does not exist in stream ${streamName}`
    );

  const message: MessageEnvelope = {
    id: uuidv4(),
    createdAt: new Date(),
    createdBy: messageEnvelope.createdBy,
    subject,
    data,
  };
  try {
    const encodedMessage = new TextEncoder().encode(JSON.stringify(message));
    const pubOpts = { expect: { streamName } };
    const ack = await js.publish(subject, encodedMessage, pubOpts);
    console.log(
      `Message published to stream ${streamName} subject ${subject}, sequence ${ack.seq}`
    );
    return ack;
  } catch (err: any) {
    throw new Error(`Error publishing to JetStream: ${err.message}`);
  }
}
