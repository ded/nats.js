export interface ItemEventDto {
  id: string;
  name: string;
  cpn: string;
  category: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  updated_by?: string;
  created_by: string;
}
