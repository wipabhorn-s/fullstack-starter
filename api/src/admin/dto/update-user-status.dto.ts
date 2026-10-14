import { UserStatus } from '@/database/generated/prisma/enums';
import { IsEnum } from 'class-validator';

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;
}
