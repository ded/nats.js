export interface DataroomCreatedEventDto {
  id: string;
  name: string;
  libraryId: string;
  description?: string;
  createdBy: string;
  createdAt: Date;
  isActive: boolean | false;
  isDefault: boolean;
  updatedAt?: Date;
  updatedBy?: string;
}
