import { Role } from '@/database/generated/prisma/enums';

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: Role;
  /**
   * User.sessionVersion ตอนออก token ไม่ตรงกับค่าปัจจุบัน = ถูกยกเลิกแล้ว
   * (ระงับบัญชี / ยกเลิกทุก session) AuthGuard ปฏิเสธทันที
   */
  ver: number;
};
