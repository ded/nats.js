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
      max_deliver: 3, // Maximum redelivery attempts
      ack_wait: 30000, // 30 seconds in nanoseconds
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
    expires: 30000, // Pull request expires after x milliseconds
    no_wait: false, // Wait for messages if none available
    max_bytes: 2 * 1024 * 1024,
    idle_heartbeat: 1000, // 1 second in nanoseconds
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
          `Consumer received message - Subject: ${msg.subject}, ID: ${messageEnvelope.id}, Sequence: ${msg.seq}`
        );
        await consumerOptions.processMessage(messageEnvelope);
        console.log(`Successfully processed message: ${messageEnvelope.id}`);
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
