export interface DataroomRoleCreatedEventDto {
  id: string;
  userId: string;
  dataroomId: string;
  dataroomRole: string;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
  updatedBy?: string;
}
