import { connect, NatsConnection, JetStreamClient, StringCodec } from "nats";
import { consumeMessages, ConsumerOptions } from "../duro-consumer";
import { exec } from "child_process";
import util from "util";
import { MessageEnvelope } from "../interfaces";
import { ItemCreatedEventDto } from "../event-dto/item-created.event.dto";
import { v4 as uuidv4 } from "uuid";
import { PublishOptions } from "../interfaces";
import { publish } from "../duro-producer";

const execPromise = util.promisify(exec);

describe("JetStream Integration Tests", () => {
  let nc: NatsConnection;
  let js: JetStreamClient;
  const streamName = "testStream";
  const subject1 = "test.subject1";
  const subject2 = "test.subject2";
  const consumerName = "testConsumer1";

  const DOCKER_COMPOSE_FILE = "./src/test/docker-compose.yml";

  beforeAll(async () => {
    try {
      await execPromise(`docker compose -f ${DOCKER_COMPOSE_FILE} up -d`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      nc = await connect({ servers: "nats://localhost:5222" });
      js = nc.jetstream();
      const jsm = await js.jetstreamManager();
      await jsm.streams.add({ name: streamName, subjects: [subject1] });
    } catch (error) {
      console.error(error);
    }
  });

  afterAll(async () => {
    await nc.drain();
    await execPromise(`docker compose -f ${DOCKER_COMPOSE_FILE} down`);
  });

  it("should publish a message to a subject in a stream", async () => {
    const messageData1: MessageEnvelope<ItemCreatedEventDto> = {
      id: uuidv4(),
      data: {
        id: "test-producer-item-id",
        name: "test-producer-item-name",
        cpn: "test-producer-item-cpn",
        category: "test-producer-item-category",
        createdAt: new Date(),
        createdBy: "test-producer-created-by",
      },
      createdAt: new Date(),
      subject: subject1,
      createdBy: "test-producer-created-by",
    };
    const publishOptions: PublishOptions<ItemCreatedEventDto> = {
      js,
      nc,
      streamName,
      messageEnvelope: messageData1,
    };
    // publish to already existing subject subject1
    let pubAck = await publish(publishOptions);
    expect(pubAck).toBeDefined();
    expect(pubAck.stream).toBe(streamName);
    expect(pubAck.seq).toBeGreaterThan(0);

    const messageData2 = { ...messageData1, subject: subject2 };
    const publishOptions2 = {
      ...publishOptions,
      messageEnvelope: messageData2,
    };
    // publish to new subject subject2 that does not exist
    pubAck = await publish(publishOptions2);
    expect(pubAck).toBeDefined();
    expect(pubAck.stream).toBe(streamName);
    expect(pubAck.seq).toBeGreaterThan(1);

    const processMessage0 = jest.fn(async (msg: MessageEnvelope) => {
      console.log("Processing message:", msg.subject);
      expect(msg.data).toBeDefined();

      stopSignal.stop = true; // Set stop signal to exit the consumer
    });
    const messageReceived: MessageEnvelope<ItemCreatedEventDto>[] = [];
    const processMessage = jest.fn(
      async (messageEnvelope: MessageEnvelope<ItemCreatedEventDto>) => {
        messageEnvelope.createdAt = new Date(messageEnvelope.createdAt);
        console.log("Processing message:", messageEnvelope.subject);
        messageReceived.push(messageEnvelope);
        stopSignal.stop = true; // Set stop signal to exit the loop
      }
    );

    const consumerOptions: ConsumerOptions<ItemCreatedEventDto> = {
      streamName,
      subjects: [subject1, subject2],
      consumerName,
      js,
      processMessage,
    };

    const stopSignal = { stop: false };
    function expectStuff(length: number) {
      expect(messageReceived.length).toBe(length);
    }
    await Promise.race([consumeMessages(consumerOptions, stopSignal)]);
    // test if the first message is the first message published -- message ordering
    expect(messageReceived[0].subject).toBe(subject1);
    expect(messageReceived[0].id).toBe(messageData1.id);
    expect(messageReceived[0].subject).toBe(messageData1.subject);
    expect(messageReceived[0].createdBy).toBe(messageData1.createdBy);
    expect(messageReceived[0].createdAt).toEqual(messageData1.createdAt);
    expect(messageReceived[0].createdAt).toBeInstanceOf(Date);
    expect(messageReceived[0].data.cpn).toBe(messageData1.data.cpn);
  });
});
