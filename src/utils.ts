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

async function checkConsumer(js: JetStreamClient, streamName: string, consumerName: string): Promise<boolean> {
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

async function checkSubject(nc: NatsConnection, streamName: string, subject: string): Promise<boolean> {
  try {
    const jsm = await nc.jetstreamManager();
    const streamInfo = await jsm.streams.info(streamName);
    return streamInfo.config.subjects.some((pattern) => subjectMatchesPattern(subject, pattern));
  } catch (err: any) {
    console.error(`Error retrieving stream information: ${err.message}`);
    throw err;
  }
}

export { checkConsumer, checkSubject, subjectMatchesPattern };
