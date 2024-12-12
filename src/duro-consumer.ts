import {
  ConsumerConfig,
  PullOptions,
  DeliverPolicy,
  AckPolicy,
  ReplayPolicy,
  JsMsg,
} from "nats";
import { checkConsumer } from "./utils";
import { MessageEnvelope, ConsumerOptions } from "./interfaces";

async function createJetStreamConsumer<T>(consumerOptions: ConsumerOptions<T>) {
  const { js, streamName, consumerName, subjects } = consumerOptions;
  const _consumerConfig = consumerOptions.consumerConfig;
  try {
    // Create the consumer configuration
    const consumerConfig: ConsumerConfig = {
      durable_name: _consumerConfig?.durable_name || consumerName,
      filter_subjects: _consumerConfig?.filter_subjects || subjects,
      deliver_policy: _consumerConfig?.deliver_policy || DeliverPolicy.All,
      ack_policy: _consumerConfig?.ack_policy || AckPolicy.Explicit,
      max_deliver: _consumerConfig?.max_deliver || 3, // Maximum redelivery attempts
      ack_wait: 10e9,
      max_ack_pending: _consumerConfig?.max_ack_pending || 1, //set to 1 for strict ordering
      replay_policy: _consumerConfig?.replay_policy || ReplayPolicy.Instant, // Maximum pending acknowledgments
      max_waiting: _consumerConfig?.max_waiting || 512,
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
  const maxRetries = 3;
  const retryDelay = 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { js } = consumerOptions;

      // Skip if connection is draining or closed
      if ((js as any).nc.isDraining() || (js as any).nc.isClosed()) {
        return;
      }

      const consumerExists = await checkConsumer(
        js,
        consumerOptions.streamName,
        consumerOptions.consumerName
      );

      if (!consumerExists) {
        await createJetStreamConsumer(consumerOptions);
      }

      const _pullOptions = consumerOptions.pullOptions;
      const pullOptions: PullOptions = {
        batch: _pullOptions?.batch || 10,
        expires: _pullOptions?.expires || 10000,
        no_wait: _pullOptions?.no_wait || false,
        max_bytes: _pullOptions?.max_bytes || 1 * 1024 * 1024,
        idle_heartbeat: _pullOptions?.idle_heartbeat || 500,
      };

      const consumer = await js.consumers.get(
        consumerOptions.streamName,
        consumerOptions.consumerName
      );

      const messages = await consumer.consume(pullOptions);
      for await (const msg of messages) {
        try {
          // Check connection state before processing each message
          if ((js as any).nc.isDraining() || (js as any).nc.isClosed()) {
            break;
          }

          const messageEnvelope: MessageEnvelope<T> = JSON.parse(
            msg.data.toString()
          );
          console.log(
            `Received message subject:${msg.subject} id:${messageEnvelope.id}`
          );
          await consumerOptions.processMessage(messageEnvelope, msg);
        } catch (error) {
          // Skip error handling if connection is draining/closed
          if ((js as any).nc.isDraining() || (js as any).nc.isClosed()) {
            break;
          }

          console.error("Error processing message:", error);
          const deliveryCount = msg.info.redeliveryCount || 0;
          if (deliveryCount >= 3) {
            await msg.term();
          } else {
            await msg.nak(5000);
          }
        }
      }

      // Exit if connection is draining/closed
      if ((js as any).nc.isDraining() || (js as any).nc.isClosed()) {
        return;
      }
    } catch (err: any) {
      // Don't retry if connection is draining/closed
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
