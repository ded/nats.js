import {
  JetStreamClient,
  ConsumerConfig,
  PullOptions,
  DeliverPolicy,
  AckPolicy,
  ReplayPolicy,
  JsMsg,
} from "nats";
import { checkConsumer } from "./utils";
import { MessageEnvelope } from "./interfaces";
export interface ConsumerOptions<T> {
  streamName: string;
  subjects: string[];
  consumerName: string;
  js: JetStreamClient;
  processMessage: (messageEnvelope: MessageEnvelope<T>) => Promise<void>;
}

async function createJetStreamConsumer<T>(consumerOptions: ConsumerOptions<T>) {
  const { js, streamName, consumerName, subjects } = consumerOptions;
  try {
    // Create the consumer configuration
    //TODO these options are subject to change but for now they are good
    const consumerConfig: ConsumerConfig = {
      durable_name: consumerName,
      filter_subjects: subjects,
      deliver_policy: DeliverPolicy.All,
      ack_policy: AckPolicy.Explicit,
      max_deliver: 1, // Maximum redelivery attempts
      ack_wait: 30, // 30 seconds in nanoseconds
      max_ack_pending: 1, //set to 1 for strict ordering
      replay_policy: ReplayPolicy.Instant, // Maximum pending acknowledgments
      max_waiting: 512,
    };
    const jsm = await js.jetstreamManager();
    const consumerInfo = await jsm.consumers.add(streamName, consumerConfig);
    return consumerInfo;
  } catch (error) {
    console.error("Error creating consumer:", error);
    throw error;
  }
}

export async function consumeMessages<T>(consumerOptions: ConsumerOptions<T>) {
  const { js } = consumerOptions;
  const consumerExists = await checkConsumer(
    js,
    consumerOptions.streamName,
    consumerOptions.consumerName
  );
  if (!consumerExists) {
    await createJetStreamConsumer(consumerOptions);
  }

  //TODO these options are subject to change but for now they are good
  const pullOptions: PullOptions = {
    batch: 10, // Number of messages to pull at once
    expires: 10000, // Pull request expires after 10 seconds
    no_wait: false, // Wait for messages if none available
    max_bytes: 1 * 1024 * 1024, // 1MB
    idle_heartbeat: 500, // 1 second in nanoseconds
  };

  try {
    const consumer = await js.consumers.get(
      consumerOptions.streamName,
      consumerOptions.consumerName
    );

    const messages = await consumer.consume(pullOptions);
    for await (const msg of messages) {
      try {
        const messageEnvelope: MessageEnvelope<T> = JSON.parse(
          msg.data.toString()
        );
        console.log(
          `Received message subject:${msg.subject} id:${messageEnvelope.id}`
        );
        await consumerOptions.processMessage(messageEnvelope);
        msg.ack();
      } catch (error) {
        console.error("Error processing message:", error);
        // Handle redelivery based on attempt count
        const deliveryCount = msg.info.redeliveryCount || 0;
        if (deliveryCount >= 3) {
          console.error("Message failed maximum retries:", msg.data.toString());
          msg.term(); // Terminal error - won't be redelivered
        } else {
          msg.nak(5000); // Negative ack - retry after 5 seconds
        }
      }
    }
  } catch (error) {
    console.error("Error in message consumption:", error);
    throw error;
  }
}
