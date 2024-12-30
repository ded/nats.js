export interface LibraryCreatedEventDto {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Date;
  archived: boolean | false;
  description?: string;
  updatedAt?: Date;
  updatedBy?: string;
  organizationId: string;
}
