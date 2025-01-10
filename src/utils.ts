import { ConsumerConfig, JetStreamClient, NatsConnection } from "nats";
import { ConsumerOptions } from ".";

function subjectMatchesPattern(subject: string, pattern: string): boolean {
  const regex = new RegExp(
    "^" +
      pattern
        .replace(/\./g, "\\.") // Escape dots for regex
        .replace(/\*/g, "[^.]+") // * matches one segment
        .replace(/>/g, ".*") + // > matches multiple segments
      "$"
  );
  return regex.test(subject);
}

async function checkSubject(
  nc: NatsConnection,
  streamName: string,
  subject: string
): Promise<void> {
  try {
    const jsm = await nc.jetstreamManager();
    const streamInfo = await jsm.streams.info(streamName);
    const subjectExists = streamInfo.config.subjects.some((pattern) =>
      subjectMatchesPattern(subject, pattern)
    );

    if (!subjectExists) {
      // If the subject doesn't exist, add it to the stream configuration
      const updatedSubjects = [...streamInfo.config.subjects, subject];
      const updatedConfig = { ...streamInfo.config, subjects: updatedSubjects };
      await jsm.streams.update(streamName, updatedConfig);
      console.log(`Subject ${subject} added to stream ${streamName}`);
    }
  } catch (err: any) {
    console.error(
      `Error retrieving or updating stream information: ${err.message}`
    );
    throw err;
  }
}

function areArraysEqual(arr1: string[], arr2: string[]): boolean {
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
  if (arr1.length !== arr2.length) return false;

  const sorted1 = [...arr1].sort();
  const sorted2 = [...arr2].sort();
  return sorted1.every((value, index) => value === sorted2[index]);
}

async function ensureConsumerConfiguration<T>(
  consumerOptions: ConsumerOptions<T>,
  DEFAULT_CONSUMER_CONFIG: ConsumerConfig
) {
  const {
    js,
    streamName,
    consumerName,
    subjects,
    consumerConfig: customConfig,
  } = consumerOptions;

  const jsm = await js.jetstreamManager();
  const consumerConfig: ConsumerConfig = {
    ...DEFAULT_CONSUMER_CONFIG,
    durable_name: customConfig?.durable_name || consumerName,
    filter_subjects: customConfig?.filter_subjects || subjects,
    ...customConfig,
  };

  let consumer;
  try {
    // Try to get existing consumer
    consumer = await jsm.consumers.info(streamName, consumerName);
  } catch (error: any) {
    // If consumer doesn't exist (404), create it
    if (error.code === "404") {
      try {
        console.log(`Consumer ${consumerName} not found, creating new one`);
        await jsm.consumers.add(streamName, consumerConfig);
        console.log(`Consumer ${consumerName} created successfully`);
        return;
      } catch (createError) {
        console.error(`Error creating consumer ${consumerName}:`, createError);
        throw createError;
      }
    } else {
      // For other errors, throw them
      console.error(`Error getting consumer info for ${consumerName}:`, error);
      throw error;
    }
  }

  // If we get here, consumer exists, check if update needed
  if (consumer) {
    const currentSubjects = consumer.config.filter_subjects || [];
    const newSubjects = consumerConfig.filter_subjects || [];
    const needsUpdate = !areArraysEqual(currentSubjects, newSubjects);

    if (needsUpdate) {
      try {
        console.log(
          `Updating consumer ${consumerName} with new subjects:`,
          newSubjects
        );
        await jsm.consumers.update(streamName, consumerName, consumerConfig);
        console.log(`Consumer ${consumerName} updated successfully`);
      } catch (updateError) {
        console.error(`Error updating consumer ${consumerName}:`, updateError);
        throw updateError;
      }
    } else {
      console.log(`Consumer ${consumerName} configuration is up to date`);
    }
  }
}

export { ensureConsumerConfiguration, checkSubject, subjectMatchesPattern };
