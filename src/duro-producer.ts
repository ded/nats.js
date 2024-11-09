import { PubAck, JetStreamClient, NatsConnection } from "nats";
import { MessageEnvelope } from "./interfaces";
import { v4 as uuidv4 } from "uuid";
import { checkSubject } from "./utils";

export interface PublishOptions<T = unknown> {
  js: JetStreamClient;
  nc: NatsConnection;
  data: T;
  subject: string;
  streamName: string;
  created_by: string;
}

export async function publish(publishOptions: PublishOptions): Promise<PubAck> {
  const { js, nc, data, subject, streamName } = publishOptions;
  if (!js) throw new Error("JetStream client not established");
  if (!data) throw new Error("Data is required");
  if (!subject) throw new Error("Subject is required");
  if (!streamName) throw new Error("Stream name is required");
  const subjectExists = await checkSubject(nc, streamName, subject);
  if (!subjectExists)
    throw new Error(
      `Subject ${subject} does not exist in stream ${streamName}`
    );

  const message: MessageEnvelope = {
    id: uuidv4(),
    created_at: new Date(),
    created_by: publishOptions.created_by,
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
