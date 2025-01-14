export interface DataroomItemCreatedEventDto {
  id: string;
  dataroomId: string;
  itemId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
  updatedBy?: string;
}
