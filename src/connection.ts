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
  try {
    const servers = Array.isArray(options.url) ? options.url : [options.url];

    const nc: NatsConnection = await connect({
      servers, // Pass as array
      user: options?.user,
      pass: options?.pass,
      timeout: 5000,
      maxReconnectAttempts: 5,
    });

    const jsm: JetStreamManager = await nc.jetstreamManager();
    const js: JetStreamClient = nc.jetstream();

    console.log(`Connected to NATS server with JetStream ${nc.getServer()}`);
    return { nc, jsm, js };
  } catch (err: any) {
    console.error("NATS Connection Error:", err);
    throw new Error(
      `Error connecting to NATS server: ${err.code || err.message}`
    );
  }
}

export async function disconnectNats(nc: NatsConnection) {
  if (nc) {
    await nc.drain();
    console.log("Disconnected from NATS server");
  }
}
