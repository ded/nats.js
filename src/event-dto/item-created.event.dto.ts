export interface ItemCreatedEventDto {
  id: string;
  name: string;
  cpn?: string;
  category?: string;
  libraryId?: string;
  roomIds?: string[];
  status?: string;
  createdAt: Date;
  createdBy: string;
  updatedAt?: Date;
  updatedBy?: string;
}
