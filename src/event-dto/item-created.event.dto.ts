export interface ItemCreatedEventDto {
  id: string;
  name: string;
  cpn?: string;
  category?: string;
  created_at: Date;
  created_by: string;
}
