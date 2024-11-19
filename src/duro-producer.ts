import { PubAck } from "nats";
import { PublishOptions } from "./interfaces";
import { checkSubject } from "./utils";
import { validate as isUUID } from "uuid";

/**
 * @description Publish a message to a stream
 * @param publishOptions - The publish options
 * @returns The publish ack
 */
export async function publish<T>(
  publishOptions: PublishOptions<T>
): Promise<PubAck> {
  const { js, nc, streamName, messageEnvelope } = publishOptions;
  const { subject, data } = messageEnvelope;
  if (!js) throw new Error("JetStream client not established");
  if (!messageEnvelope) throw new Error("Message envelope is required");
  if (!messageEnvelope.id || !isUUID(messageEnvelope.id)) {
    throw new Error("Message id is required and must be a valid UUID");
  }
  if (!subject) throw new Error("Subject is required");
  if (!data) throw new Error("Data is required");
  if (!streamName) throw new Error("Stream name is required");

  await checkSubject(nc, streamName, subject);

  try {
    const encodedMessage = new TextEncoder().encode(
      JSON.stringify(messageEnvelope)
    );
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
