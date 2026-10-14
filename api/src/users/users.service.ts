import { Prisma } from '@/database/generated/prisma/client';
import { PrismaService } from '@/database/prisma.service';
import { BcryptService } from '@/infrastructure/hash/bcrypt.service';
import { ConflictException, Injectable } from '@nestjs/common';

/**
 * field ที่ส่งออกไปนอก API ได้ — ไม่มี password, googleId, sessionVersion
 * ทุก query ที่คืนข้อมูลผู้ใช้ให้เว็บต้องใช้ select นี้
 */
export const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{
  select: typeof PUBLIC_USER_SELECT;
}>;

/** ข้อมูลที่ AuthService ต้องใช้ออก token (ภายใน API เท่านั้น) */
const SESSION_USER_SELECT = {
  ...PUBLIC_USER_SELECT,
  sessionVersion: true,
} satisfies Prisma.UserSelect;

export type SessionUser = Prisma.UserGetPayload<{
  select: typeof SESSION_USER_SELECT;
}>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bcryptService: BcryptService,
  ) {}

  /** ทุก method มองไม่เห็นบัญชีที่ soft delete ไปแล้ว */
  findById(id: string) {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: SESSION_USER_SELECT,
    });
  }

  /** สำหรับส่งให้เว็บ (GET /users/me) */
  findPublicById(id: string) {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: PUBLIC_USER_SELECT,
    });
  }

  /** ใช้ตอนล็อกอิน: ต้องมี password hash ไว้เทียบ */
  findByEmailWithPassword(email: string) {
    return this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
      select: { ...SESSION_USER_SELECT, password: true },
    });
  }

  findByGoogleId(googleId: string) {
    return this.prisma.user.findFirst({
      where: { googleId, deletedAt: null },
      select: SESSION_USER_SELECT,
    });
  }

  async create(input: { name: string; email: string; password: string }) {
    const password = await this.bcryptService.hash(input.password);

    try {
      return await this.prisma.user.create({
        data: { ...input, email: input.email.toLowerCase(), password },
        select: SESSION_USER_SELECT,
      });
    } catch (error) {
      // email เป็น unique: อีเมลซ้ำ (รวมแถวที่ soft delete แล้ว เพราะยังจองอีเมลไว้)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          message: 'This email is already registered',
          code: 'EMAIL_TAKEN',
        });
      }
      throw error;
    }
  }

  /**
   * ล็อกอินด้วย Google ครั้งแรก: มีบัญชีอีเมลนี้อยู่แล้ว = ผูก googleId เข้าไป
   * ไม่มี = สร้างใหม่แบบไม่มีรหัสผ่าน
   *
   * ผูกเข้าบัญชีเดิมได้เพราะ GoogleAuthService ปฏิเสธอีเมลที่ Google ยังไม่ยืนยัน
   * Google จึงรับรองให้แล้วว่าคนที่ล็อกอินอยู่เป็นเจ้าของอีเมลนี้จริง
   */
  async upsertGoogleUser(profile: {
    googleId: string;
    email: string;
    name: string;
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: profile.email },
      select: { id: true, deletedAt: true },
    });

    if (existing?.deletedAt) {
      // อีเมลนี้เป็นของบัญชีที่ลบไปแล้ว ไม่ชุบชีวิตกลับมาเงียบ ๆ
      throw new ConflictException({
        message: 'This account has been deleted',
        code: 'ACCOUNT_DELETED',
      });
    }

    if (existing) {
      return this.prisma.user.update({
        where: { id: existing.id },
        data: { googleId: profile.googleId },
        select: SESSION_USER_SELECT,
      });
    }

    return this.prisma.user.create({
      data: profile,
      select: SESSION_USER_SELECT,
    });
  }
}
