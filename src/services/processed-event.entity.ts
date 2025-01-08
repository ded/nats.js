import { Column, CreateDateColumn, Entity, PrimaryColumn } from "typeorm";

@Entity("processed_events")
export class ProcessedEvent {
  @PrimaryColumn("uuid", { name: "message_id" })
  messageId!: string;

  @Column("varchar")
  subject!: string;

  @CreateDateColumn({
    name: "processed_at",
    type: "timestamp with time zone",
  })
  processedAt!: Date;
}
