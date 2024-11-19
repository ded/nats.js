import { JetStreamClient, NatsConnection, PubAck } from "nats";
import { publish } from "../duro-producer";
import { checkSubject } from "../utils";
import { MessageEnvelope, PublishOptions } from "../interfaces";
import { v4 as uuidv4 } from "uuid";

jest.mock("../utils", () => ({
  checkSubject: jest.fn(),
}));

describe("publish", () => {
  let mockJs: jest.Mocked<JetStreamClient>;
  let mockNc: jest.Mocked<NatsConnection>;
  let mockPubAck: PubAck;
  let publishOptions: PublishOptions<{ test: string }>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPubAck = { seq: 1 } as PubAck;
    mockJs = {
      publish: jest.fn().mockResolvedValue(mockPubAck),
    } as unknown as jest.Mocked<JetStreamClient>;
    mockNc = {} as jest.Mocked<NatsConnection>;
    (checkSubject as jest.Mock).mockResolvedValue(true);
    publishOptions = {
      js: mockJs,
      nc: mockNc,
      streamName: "test-stream",
      messageEnvelope: {
        id: uuidv4(),
        createdAt: new Date(),
        subject: "test.subject",
        data: { test: "data" },
        createdBy: "duro-producer",
      },
    };
  });

  it("should successfully publish a message", async () => {
    const result = await publish(publishOptions);

    const expectedMessage: MessageEnvelope<{ test: string }> = {
      id: uuidv4(),
      createdAt: new Date(),
      subject: "test.subject",
      data: { test: "data" },
      createdBy: "duro-producer",
    };

    expect(mockJs.publish).toHaveBeenCalledWith(
      "test.subject",
      expect.any(Uint8Array),
      {
        expect: { streamName: "test-stream" },
      }
    );

    const encodedMessageArg = mockJs.publish.mock.calls[0][1];
    expect(result).toBe(mockPubAck);
  });

  it("should throw error when JetStream client is not provided", async () => {
    publishOptions.js = undefined as unknown as JetStreamClient;

    await expect(publish(publishOptions)).rejects.toThrow(
      "JetStream client not established"
    );
  });

  it("should throw error when data is not provided", async () => {
    publishOptions.messageEnvelope.data = undefined as unknown as any;

    await expect(publish(publishOptions)).rejects.toThrow("Data is required");
  });

  it("should throw error when subject is not provided", async () => {
    publishOptions.messageEnvelope.subject = "";

    await expect(publish(publishOptions)).rejects.toThrow(
      "Subject is required"
    );
  });

  it("should throw error when stream name is not provided", async () => {
    publishOptions.streamName = "";

    await expect(publish(publishOptions)).rejects.toThrow(
      "Stream name is required"
    );
  });

  it("should throw error when publish fails", async () => {
    const error = new Error("Publish failed");
    mockJs.publish.mockRejectedValue(error);

    await expect(publish(publishOptions)).rejects.toThrow(
      "Error publishing to JetStream: Publish failed"
    );
  });

  it("should handle subject check failure", async () => {
    (checkSubject as jest.Mock).mockRejectedValue(
      new Error("Failed to check subject")
    );

    await expect(publish(publishOptions)).rejects.toThrow(
      "Failed to check subject"
    );
  });
});
