import { Injectable, Logger } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { ProcessedEvent } from "./processed-event.entity";
import { MessageInfo } from "../interfaces";

@Injectable()
export class MessageDeduplicationService {
  private readonly logger = new Logger(MessageDeduplicationService.name);

  constructor(private readonly dataSource: DataSource) {}

  async processWithDeduplication<T extends MessageInfo, R>(
    message: T,
    processor: (message: T, entityManager: EntityManager) => Promise<R>
  ): Promise<{ isProcessed: boolean; result?: R }> {
    try {
      let result: R;
      const processed = await this.dataSource.transaction(
        async (entityManager) => {
          // Check if already processed
          const isProcessed = await this.isMessageProcessed(
            message.id,
            entityManager
          );

          if (isProcessed) {
            this.logger.warn(
              `Message ${message.id} already processed, skipping`
            );
            return true;
          }

          // Process the message
          result = await processor(message, entityManager);

          // Record that we processed this message
          await this.recordMessageProcessed(message, entityManager);
          return false;
        }
      );

      return {
        isProcessed: processed,
        result: processed ? undefined : result,
      };
    } catch (error) {
      this.logger.error(
        `Error processing message ${message.id}: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  private async isMessageProcessed(
    messageId: string,
    entityManager: EntityManager
  ): Promise<boolean> {
    const processedEvent = await entityManager.findOne(ProcessedEvent, {
      where: { messageId },
    });
    return !!processedEvent;
  }

  private async recordMessageProcessed(
    message: MessageInfo,
    entityManager: EntityManager
  ): Promise<void> {
    const processedEvent = new ProcessedEvent();
    processedEvent.messageId = message.id;
    processedEvent.subject = message.subject;
    await entityManager.save(ProcessedEvent, processedEvent);
  }
}

// Optional cleanup service
@Injectable()
export class ProcessedEventCleanupService {
  private readonly logger = new Logger(ProcessedEventCleanupService.name);

  constructor(private readonly dataSource: DataSource) {}

  async cleanupOldEvents(daysToKeep = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    try {
      const result = await this.dataSource
        .createQueryBuilder()
        .delete()
        .from(ProcessedEvent)
        .where("processed_at < :cutoffDate", { cutoffDate })
        .execute();

      this.logger.log(`Cleaned up ${result.affected} old processed events`);
    } catch (error) {
      this.logger.error("Failed to clean up old events:", error);
      throw error;
    }
  }
}
