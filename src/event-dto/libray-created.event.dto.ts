export interface LibraryCreatedEventDto {
  id: string;
  name: string;
  ownerId: string;
  ownerType: "User" | "Organization";
  createdBy: string;
  createdAt: Date;
  archived: boolean | false;
  description?: string;
  updatedAt?: Date;
  updatedBy?: string;
  organizationId: string;
}
