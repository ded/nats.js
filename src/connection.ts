import { connect, NatsConnection } from "nats";
import { NatsConnectionOptions, NatsContext } from "./interfaces";
export async function connectNats(
  options: NatsConnectionOptions
): Promise<NatsContext> {
  try {
    const nc = await connect({
      servers: options.url,
      user: options?.user,
      pass: options?.pass,
    });
    const jsm = await nc.jetstreamManager();
    const js = nc.jetstream();
    console.log("Connected to NATS server with JetStream");
    return { nc, jsm, js };
  } catch (err: any) {
    throw new Error(`Error connecting to NATS server: ${err.message}`);
  }
}

export async function disconnectNats(nc: NatsConnection) {
  if (nc) {
    await nc.drain();
    console.log("Disconnected from NATS server");
  }
}
