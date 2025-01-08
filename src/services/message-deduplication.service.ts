import { Injectable, Logger } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { MessageEnvelope } from "../interfaces";
import { ProcessedEvent } from "./processed-event.entity";

@Injectable()
export class MessageDeduplicationService {
  private readonly logger = new Logger(MessageDeduplicationService.name);

  async isProcessed(
    messageId: string,
    entityManager: EntityManager
  ): Promise<boolean> {
    const processedEvent = await entityManager.findOne(ProcessedEvent, {
      where: { messageId },
    });
    return !!processedEvent;
  }

  async recordProcessed(
    message: MessageEnvelope,
    entityManager: EntityManager
  ): Promise<void> {
    const processedEvent = new ProcessedEvent();
    processedEvent.messageId = message.id;
    processedEvent.subject = message.subject;
    await entityManager.save(ProcessedEvent, processedEvent);
  }
}
