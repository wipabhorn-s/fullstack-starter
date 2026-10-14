import { Role } from '@/database/generated/prisma/enums';
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'ROLES';

// ...roles = รับได้หลายตัว เช่น @Roles(Role.USER, Role.ADMIN)
export function Roles(...role: Role[]) {
  return SetMetadata(ROLES_KEY, role);
}
