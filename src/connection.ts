import {
  connect,
  JetStreamClient,
  JetStreamManager,
  NatsConnection,
} from "nats";
import { NatsConnectionOptions, NatsContext } from "./interfaces";

export async function connectNats(
  options: NatsConnectionOptions
): Promise<NatsContext> {
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second between retries

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const servers = Array.isArray(options.url) ? options.url : [options.url];

      const nc: NatsConnection = await connect({
        servers,
        user: options?.user,
        pass: options?.pass,
        timeout: 10000,
        waitOnFirstConnect: true,
        reconnectTimeWait: 500,
        reconnectJitter: 100,
        maxReconnectAttempts: 5,
      });

      // Small delay before JetStream initialization
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const jsm: JetStreamManager = await nc.jetstreamManager();
      const js: JetStreamClient = nc.jetstream();

      return { nc, jsm, js };
    } catch (err: any) {
      if (attempt === maxRetries) {
        throw new Error(
          `Failed to connect to NATS server after ${maxRetries} attempts: ${
            err.code || err.message
          }`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  // TypeScript requires this even though it's unreachable
  throw new Error("Failed to connect to NATS server");
}

export async function disconnectNats(nc: NatsConnection) {
  if (nc) {
    await nc.drain();
    console.log("Disconnected from NATS server");
  }
}
