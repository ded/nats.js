import { JetStreamClient, NatsConnection } from "nats";

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

async function checkConsumer(
  js: JetStreamClient,
  streamName: string,
  consumerName: string
): Promise<boolean> {
  try {
    await js.consumers.get(streamName, consumerName);
    return true;
  } catch (error: any) {
    // Check if error is specifically about consumer not existing
    if (error.code === "404") {
      return false;
    }
    // Rethrow other errors
    console.error("Error checking consumer:", error);
    throw error;
  }
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

export { checkConsumer, checkSubject, subjectMatchesPattern };
