export interface ItemCreatedEventDto {
  id: string;
  name: string;
  cpn?: string;
  category?: string;
  createdAt: Date;
  createdBy: string;
}
