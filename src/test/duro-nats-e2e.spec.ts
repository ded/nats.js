import { connect, NatsConnection, JetStreamClient, JsMsg } from "nats";
import { consumeMessages } from "../duro-consumer";
import { ConsumerOptions } from "../interfaces";
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
      console.log("starting docker compose");
      await execPromise(`docker compose -f ${DOCKER_COMPOSE_FILE} up -d`);
      console.log("waiting for nats to start");
      await new Promise((resolve) => setTimeout(resolve, 2000));
      console.log("connecting to nats");
      nc = await connect({ servers: "nats://localhost:5222" });
      js = nc.jetstream();
      const jsm = await js.jetstreamManager();
      // only add subject1 to the stream
      console.log("adding subject1 to the stream");
      await jsm.streams.add({ name: streamName, subjects: [subject1] });
    } catch (error) {
      console.error(error);
    }
  }, 300000);

  afterAll(async () => {
    console.log("draining nats connection");
    await nc.drain();
    await nc.close();
    console.log("stopping docker compose");
    await execPromise(`docker compose -f ${DOCKER_COMPOSE_FILE} down`);
  }, 300000);

  it("should publish a message to a subject in a stream", async () => {
    const messageData1: MessageEnvelope<ItemCreatedEventDto> = {
      id: uuidv4(),
      data: {
        id: "test-producer-item-id-1",
        name: "test-producer-item-name-1",
        cpn: "test-producer-item-cpn-1",
        category: "test-producer-item-category-1",
        createdAt: new Date(),
        createdBy: "test-producer-created-by-1",
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
    const pubAck1 = await publish(publishOptions);
    expect(pubAck1).toBeDefined();
    expect(pubAck1.stream).toBe(streamName);
    expect(pubAck1.seq).toBeGreaterThan(0);

    const messageData2 = { ...messageData1, subject: subject2 };
    const publishOptions2 = {
      ...publishOptions,
      messageEnvelope: messageData2,
    };
    // publish to new subject subject2 that does not exist and should be added to the stream
    const pubAck2 = await publish(publishOptions2);
    expect(pubAck2).toBeDefined();
    expect(pubAck2.stream).toBe(streamName);
    expect(pubAck2.seq).toBeGreaterThan(1);

    const messageData3 = {
      ...messageData1,
      subject: subject1,
      createdBy: "test-producer-created-by-2",
      name: "test-producer-item-name-2",
      cpn: "test-producer-item-cpn-2",
      category: "test-producer-item-category-2",
    };
    const publishOptions3 = {
      ...publishOptions,
      messageEnvelope: messageData3,
    };

    const messageData4 = {
      ...messageData1,
      subject: subject1,
      createdBy: "test-producer-created-by-4",
      name: "test-producer-item-name-4",
      cpn: "test-producer-item-cpn-4",
      category: "test-producer-item-category-4",
    };
    const publishOptions4 = {
      ...publishOptions,
      messageEnvelope: messageData4,
    };

    const messageData5 = {
      ...messageData1,
      subject: subject1,
      createdBy: "test-producer-created-by-5",
      name: "test-producer-item-name-5",
      cpn: "test-producer-item-cpn-5",
      category: "test-producer-item-category-5",
    };
    const publishOptions5 = {
      ...publishOptions,
      messageEnvelope: messageData5,
    };

    // publish to subject1 again to test message ordering
    const pubAck3 = await publish(publishOptions3);
    // publish to subject1 again to test message ordering
    const pubAck4 = await publish(publishOptions4);

    // publish to subject1 again to after 15 seconds to test message pulling
    await new Promise((resolve) => setTimeout(resolve, 15000));
    const pubAck5 = await publish(publishOptions5);

    expect(pubAck3).toBeDefined();
    expect(pubAck3.stream).toBe(streamName);
    expect(pubAck3.seq).toBeGreaterThan(2);

    expect(pubAck4).toBeDefined();
    expect(pubAck4.stream).toBe(streamName);
    expect(pubAck4.seq).toBeGreaterThan(3);

    const messageReceived: MessageEnvelope<ItemCreatedEventDto>[] = [];
    const processMessage = async (
      messageEnvelope: MessageEnvelope<ItemCreatedEventDto>,
      msg: JsMsg
    ) => {
      messageEnvelope.createdAt = new Date(messageEnvelope.createdAt);
      console.log("Processing message:", messageEnvelope.subject);
      messageReceived.push(messageEnvelope);
      msg.ack();
    };

    const consumerOptions: ConsumerOptions<ItemCreatedEventDto> = {
      streamName,
      subjects: [subject1, subject2],
      consumerName,
      js,
      processMessage,
    };

    const consumePromise = new Promise<void>((resolve) => {
      const consumeMessagesWithResolve = async () => {
        await consumeMessages(consumerOptions);
        setTimeout(() => {
          resolve();
        }, 10000);
      };
      consumeMessagesWithResolve();
    });

    // Wait for either the consumePromise to resolve or a timeout of 10 seconds
    await Promise.race([
      consumePromise,
      new Promise((resolve) => setTimeout(resolve, 10000)),
    ]);

    expect(messageReceived.length).toBe(5);
    expect(messageReceived[0].subject).toBe(subject1);
    expect(messageReceived[0].id).toBe(messageData1.id);
    expect(messageReceived[0].subject).toBe(messageData1.subject);
    expect(messageReceived[0].createdBy).toBe(messageData1.createdBy);
    expect(messageReceived[0].createdAt).toEqual(messageData1.createdAt);
    expect(messageReceived[0].createdAt).toBeInstanceOf(Date);
    expect(messageReceived[0].data.cpn).toBe(messageData1.data.cpn);

    console.log("test message ordering");
    expect(messageReceived[2].subject).toBe(subject1);
    expect(messageReceived[2].id).toBe(messageData3.id);
    expect(messageReceived[2].subject).toBe(messageData3.subject);
    expect(messageReceived[2].createdBy).toBe(messageData3.createdBy);
    expect(messageReceived[2].createdAt).toEqual(messageData3.createdAt);
    expect(messageReceived[2].createdAt).toBeInstanceOf(Date);
    expect(messageReceived[2].data.cpn).toBe(messageData1.data.cpn);

    expect(messageReceived[1].subject).toBe(subject2);
    expect(messageReceived[1].id).toBe(messageData2.id);
    expect(messageReceived[1].subject).toBe(messageData2.subject);
    expect(messageReceived[1].createdBy).toBe(messageData2.createdBy);
    expect(messageReceived[1].createdAt).toEqual(messageData2.createdAt);
    expect(messageReceived[1].createdAt).toBeInstanceOf(Date);
    expect(messageReceived[1].data.cpn).toBe(messageData2.data.cpn);

    expect(messageReceived[3].subject).toBe(subject1);
    expect(messageReceived[3].id).toBe(messageData4.id);
    expect(messageReceived[3].subject).toBe(messageData4.subject);
    expect(messageReceived[3].createdBy).toBe(messageData4.createdBy);
    expect(messageReceived[3].createdAt).toEqual(messageData4.createdAt);
    expect(messageReceived[3].createdAt).toBeInstanceOf(Date);
    expect(messageReceived[3].data.cpn).toBe(messageData4.data.cpn);

    console.log("test message pulling after 15 seconds");
    expect(messageReceived[4].subject).toBe(subject1);
    expect(messageReceived[4].id).toBe(messageData5.id);
    expect(messageReceived[4].subject).toBe(messageData5.subject);
    expect(messageReceived[4].createdBy).toBe(messageData5.createdBy);
    expect(messageReceived[4].createdAt).toEqual(messageData5.createdAt);
    expect(messageReceived[4].createdAt).toBeInstanceOf(Date);
    expect(messageReceived[4].data.cpn).toBe(messageData5.data.cpn);
  }, 50000);
});
