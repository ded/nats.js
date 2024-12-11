import { PubAck } from "nats";
import { PublishOptions } from "./interfaces";
import { checkSubject } from "./utils";
import { validate as isUUID } from "uuid";

/**
 * Maximum number of retries for publishing
 */
const MAX_RETRIES = 3;

/**
 * Base delay between retries in milliseconds
 */
const BASE_RETRY_DELAY = 1000;

/**
 * Delays execution for specified milliseconds
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @description Publish a message to a stream with retries
 * @param publishOptions - The publish options
 * @returns The publish ack
 */
export async function publish<T>(
  publishOptions: PublishOptions<T>
): Promise<PubAck> {
  const { js, nc, streamName, messageEnvelope } = publishOptions;

  // Validate inputs
  if (!js) throw new Error("JetStream client not established");
  if (!messageEnvelope) throw new Error("Message envelope is required");
  if (!messageEnvelope.id || !isUUID(messageEnvelope.id)) {
    throw new Error("Message id is required and must be a valid UUID");
  }
  if (!messageEnvelope.subject) throw new Error("Subject is required");
  if (!messageEnvelope.data) throw new Error("Data is required");
  if (!streamName) throw new Error("Stream name is required");

  let lastError: Error | null = null;

  // Try publishing with retries
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await checkSubject(nc, streamName, messageEnvelope.subject);

      const encodedMessage = new TextEncoder().encode(
        JSON.stringify(messageEnvelope)
      );
      const pubOpts = { expect: { streamName } };

      const ack = await js.publish(
        messageEnvelope.subject,
        encodedMessage,
        pubOpts
      );

      console.log(
        `Message ${messageEnvelope.id} published to stream ${streamName} subject ${messageEnvelope.subject}, sequence ${ack.seq} (attempt ${attempt}/${MAX_RETRIES})`
      );

      return ack;
    } catch (err: any) {
      lastError = err;

      // If this was our last attempt, throw the error
      if (attempt === MAX_RETRIES) {
        console.error(
          `Failed to publish message ${messageEnvelope.id} after ${MAX_RETRIES} attempts:`,
          err
        );
        throw new Error(
          `Error publishing to JetStream after ${MAX_RETRIES} attempts: ${err.message}`
        );
      }

      // Otherwise wait with exponential backoff before retrying
      const backoffDelay = BASE_RETRY_DELAY * Math.pow(2, attempt - 1);
      console.warn(
        `Publish attempt ${attempt}/${MAX_RETRIES} failed for message ${messageEnvelope.id}, retrying in ${backoffDelay}ms:`,
        err.message
      );

      await delay(backoffDelay);
    }
  }

  // This should never be reached due to the throw in the loop above
  throw lastError || new Error("Unexpected publish failure");
}
