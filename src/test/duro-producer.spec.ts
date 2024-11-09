import { JetStreamClient, NatsConnection, PubAck } from "nats";
import { publish, PublishOptions } from "../duro-producer";
import { checkSubject } from "../utils";
import { MessageEnvelope } from "../interfaces";

jest.mock("uuid", () => ({
  v4: jest.fn().mockReturnValue("mock-uuid"),
}));

jest.mock("../utils", () => ({
  checkSubject: jest.fn(),
}));

describe("publish", () => {
  let mockJs: jest.Mocked<JetStreamClient>;
  let mockNc: jest.Mocked<NatsConnection>;
  let mockPubAck: PubAck;
  let publishOptions: PublishOptions;

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
      data: { test: "data" },
      subject: "test.subject",
      streamName: "test-stream",
      created_by: "duro-producer",
    };
  });

  it("should successfully publish a message", async () => {
    const result = await publish(publishOptions);

    const expectedMessage: MessageEnvelope = {
      id: "mock-uuid",
      created_at: expect.any(Date),
      subject: "test.subject",
      data: { test: "data" },
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
    publishOptions.data = undefined as unknown as any;

    await expect(publish(publishOptions)).rejects.toThrow("Data is required");
  });

  it("should throw error when subject is not provided", async () => {
    publishOptions.subject = "";

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

  it("should throw error when subject does not exist in stream", async () => {
    (checkSubject as jest.Mock).mockResolvedValue(false);

    await expect(publish(publishOptions)).rejects.toThrow(
      "Subject test.subject does not exist in stream test-stream"
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
