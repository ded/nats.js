import {
  ConsumerConfig,
  PullOptions,
  DeliverPolicy,
  AckPolicy,
  ReplayPolicy,
  JsMsg,
} from "nats";
import { ensureConsumerConfiguration } from "./utils";
import { MessageEnvelope, ConsumerOptions } from "./interfaces";

const DEFAULT_CONSUMER_CONFIG = {
  deliver_policy: DeliverPolicy.All,
  ack_policy: AckPolicy.Explicit,
  max_deliver: 3,
  ack_wait: 10e9,
  max_ack_pending: 1,
  replay_policy: ReplayPolicy.Instant,
  max_waiting: 512,
};

const DEFAULT_PULL_OPTIONS = {
  batch: 10,
  expires: 10000,
  no_wait: false,
  max_bytes: 1 * 1024 * 1024,
  idle_heartbeat: 500,
};

async function createJetStreamConsumer<T>(consumerOptions: ConsumerOptions<T>) {
  const {
    js,
    streamName,
    consumerName,
    subjects,
    consumerConfig: customConfig,
  } = consumerOptions;

  const consumerConfig: ConsumerConfig = {
    ...DEFAULT_CONSUMER_CONFIG,
    durable_name: customConfig?.durable_name || consumerName,
    filter_subjects: customConfig?.filter_subjects || subjects,
    ...customConfig,
  };

  try {
    const jsm = await js.jetstreamManager();
    return await jsm.consumers.add(streamName, consumerConfig);
  } catch (error) {
    console.error("Error creating consumer:", error);
    throw error;
  }
}

function isConnectionActive(js: any): boolean {
  return !js.nc.isDraining() && !js.nc.isClosed();
}

async function processMessage<T>(
  msg: JsMsg,
  consumerOptions: ConsumerOptions<T>
) {
  try {
    if (!isConnectionActive(consumerOptions.js)) return;

    const messageEnvelope: MessageEnvelope<T> = JSON.parse(msg.data.toString());
    console.log(
      `Received message subject:${msg.subject} id:${messageEnvelope.id}`
    );
    await consumerOptions.processMessage(messageEnvelope, msg);
  } catch (error) {
    if (!isConnectionActive(consumerOptions.js)) return;

    console.error("Error processing message:", error);
    const deliveryCount = msg.info.redeliveryCount || 0;
    if (deliveryCount >= 3) {
      await msg.term();
    } else {
      await msg.nak(5000);
    }
  }
}

export async function consumeMessages<T>(consumerOptions: ConsumerOptions<T>) {
  const maxRetries = 3;
  const retryDelay = 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { js, streamName, consumerName } = consumerOptions;

      if (!isConnectionActive(js)) return;
      await ensureConsumerConfiguration(
        consumerOptions,
        DEFAULT_CONSUMER_CONFIG
      );

      const pullOptions: PullOptions = {
        ...DEFAULT_PULL_OPTIONS,
        ...consumerOptions.pullOptions,
      };

      const consumer = await js.consumers.get(streamName, consumerName);
      const messages = await consumer.consume(pullOptions);

      for await (const msg of messages) {
        await processMessage(msg, consumerOptions);
        if (!isConnectionActive(js)) break;
      }

      if (!isConnectionActive(js)) return;
    } catch (err: any) {
      if (
        err.code === "CONNECTION_DRAINING" ||
        err.code === "CONNECTION_CLOSED"
      ) {
        return;
      }

      if (attempt === maxRetries) {
        throw new Error(
          `Failed to set up consumer after ${maxRetries} attempts: ${
            err.code || err.message
          }`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
}
