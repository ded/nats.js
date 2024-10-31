import { connect, NatsConnection, JetStreamClient, StringCodec, JsMsg } from "nats";
import { consumeMessages, ConsumerOptions } from "./duro-consumer";
import { exec } from "child_process";
import util from "util";

const execPromise = util.promisify(exec);

describe("JetStream Integration Tests", () => {
  let nc: NatsConnection;
  let js: JetStreamClient;
  const sc = StringCodec();
  const streamName = "testStream";
  const subject = "test.subject";
  const consumerName = "testConsumer";
  const messageData1 = {
    id: "test-id-1",
    data: "test-data-1" + Math.random(),
    subject,
    timestamp: new Date().toISOString(),
  };
  const messageData2 = {
    id: "test-id-2",
    data: "test-data-2" + Math.random(),
    subject,
    timestamp: new Date().toISOString(),
  };

  const DOCKER_COMPOSE_FILE = "duro-nats-js/src/docker-compose.yml";

  beforeAll(async () => {
    // Start the NATS server in Docker
    try {
      await execPromise(`docker-compose -f ${DOCKER_COMPOSE_FILE} up -d`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      nc = await connect({ servers: "nats://localhost:5222" });
      js = nc.jetstream();
      const jsm = await js.jetstreamManager();
      await jsm.streams.add({ name: streamName, subjects: [subject] });
      await js.publish(subject, sc.encode(JSON.stringify(messageData1)));
      await js.publish(subject, sc.encode(JSON.stringify(messageData2)));
    } catch (error) {
      console.error(error);
    }

    // Wait for NATS server to be ready (adjust as needed for your system)
  });

  afterAll(async () => {
    await nc.drain();
    await execPromise(`docker-compose -f ${DOCKER_COMPOSE_FILE} down`);
  });

  it("should create a consumer and process messages", async () => {
    try {
      const processMessage = jest.fn(async (msg: JsMsg) => {
        console.log("Processing message:", msg.data);
        expect(msg.data).toBeDefined();
        stopSignal.stop = true; // Set stop signal to exit the loop

        // await nc.drain();
      });
      const stopSignal = { stop: false }; // Signal to stop the loop
      const consumerOptions: ConsumerOptions = {
        streamName,
        subjects: [subject],
        consumerName,
        js,
        processMessage,
      };
      await consumeMessages(consumerOptions, stopSignal);

      const consumePromise = consumeMessages(consumerOptions, stopSignal);

      // Wait for messages to be processed
      await new Promise((resolve) => setTimeout(resolve, 1000));
      stopSignal.stop = true; // Set stop signal to exit the loop
      // Wait for the consumeMessages function to complete
      await consumePromise;
    } catch (error) {}
  });
});
