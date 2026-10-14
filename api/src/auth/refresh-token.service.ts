import { EnvVariable } from '@/config/env.validation';
import { PrismaService } from '@/database/prisma.service';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';

/**
 * ใบที่เพิ่งถูกใช้ไป ยังขอใบใหม่ซ้ำได้ภายในช่วงนี้ (ไม่นับว่า token หลุด)
 * หน้าเว็บมักยิงหลายคำขอพร้อมกันตอน access token ใกล้หมดอายุ ทุกคำขอถือ
 * refresh token ใบเดียวกัน ถ้าไม่ผ่อนให้ คำขอที่สองจะทำให้ผู้ใช้หลุดออกจากระบบ
 */
export const REUSE_GRACE_MS = 30_000;

const invalid = () =>
  new UnauthorizedException({
    message: 'Your session has expired. Please log in again.',
    code: 'REFRESH_INVALID',
  });

/**
 * refresh token: ขอ access token ใบใหม่ได้โดยไม่ต้องล็อกอินซ้ำ
 * - เก็บเฉพาะ sha256 คนที่เข้าถึงฐานข้อมูลได้เอาไปใช้แทนเจ้าของไม่ได้
 * - หมุนใบใหม่ทุกครั้งที่ใช้ (rotation) ทุกใบจากการล็อกอินครั้งเดียวอยู่ family เดียวกัน
 * - ใบที่ใช้ไปแล้วถูกเอามาใช้ซ้ำหลังพ้นช่วงผ่อนผัน = token หลุด → ยกเลิกทั้ง family
 */
@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<EnvVariable, true>,
  ) {}

  private hash(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /** ออกใบใหม่ ไม่ส่ง familyId = เริ่ม family ใหม่ (ล็อกอินครั้งใหม่) */
  async issue(
    userId: string,
    familyId: string = crypto.randomUUID(),
  ): Promise<string> {
    const raw = crypto.randomBytes(32).toString('base64url');
    const expiresInSec = this.configService.get('REFRESH_TOKEN_EXPIRES_IN', {
      infer: true,
    });

    await this.prisma.$transaction([
      // เก็บกวาดใบที่หมดอายุแล้วของคนนี้ไปด้วย ตารางจะได้ไม่โตเรื่อย ๆ
      this.prisma.refreshToken.deleteMany({
        where: { userId, expiresAt: { lte: new Date() } },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId,
          familyId,
          tokenHash: this.hash(raw),
          expiresAt: new Date(Date.now() + expiresInSec * 1000),
        },
      }),
    ]);

    return raw;
  }

  /**
   * ใช้ใบเดิมแลกใบใหม่ คืน userId ของเจ้าของ และ refresh token ใบใหม่
   * ใบเดิมใช้ไม่ได้อีก (ยกเว้นในช่วงผ่อนผันสั้น ๆ ดู REUSE_GRACE_MS)
   */
  async rotate(raw: string): Promise<{ userId: string; refreshToken: string }> {
    const now = new Date();
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(raw) },
    });

    if (!record || record.revokedAt || record.expiresAt <= now) {
      throw invalid();
    }

    if (!record.usedAt) {
      // ล็อกแบบมีเงื่อนไข: คำขอที่มาพร้อมกันได้ count = 0 แล้วไปทางผ่อนผันแทน
      const { count } = await this.prisma.refreshToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: now },
      });
      if (count === 1) {
        return {
          userId: record.userId,
          refreshToken: await this.issue(record.userId, record.familyId),
        };
      }
    }

    const usedAt = record.usedAt ?? now;
    if (now.getTime() - usedAt.getTime() <= REUSE_GRACE_MS) {
      return {
        userId: record.userId,
        refreshToken: await this.issue(record.userId, record.familyId),
      };
    }

    // ใบนี้ถูกแลกไปนานแล้ว มีคนเอามาใช้อีก: อาจมีคนขโมย token ไป
    // ยกเลิกทุกใบใน family นี้ ทั้งเจ้าของจริงและคนที่ขโมยต้องล็อกอินใหม่
    await this.revokeFamily(record.familyId);
    this.logger.warn(
      `Refresh token reused after rotation (user ${record.userId}, family ${record.familyId}); family revoked`,
    );
    throw new UnauthorizedException({
      message: 'Your session is no longer valid. Please log in again.',
      code: 'REFRESH_REUSED',
    });
  }

  /** Log out: ยกเลิก family ของใบนี้ (เครื่องนี้เครื่องเดียว) ไม่มีใบนี้ก็ไม่ error */
  async revoke(raw: string): Promise<void> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(raw) },
      select: { familyId: true },
    });
    if (record) await this.revokeFamily(record.familyId);
  }

  /**
   * ยกเลิกทุก session ของผู้ใช้ (ทุกเครื่อง) และทำให้ access token ที่ออกไปแล้ว
   * ใช้ไม่ได้ทันที: เพิ่ม sessionVersion ทุกใบที่ออกก่อนหน้าพกเลขเก่า AuthGuard ปฏิเสธ
   * คืนเลขรุ่นใหม่ ใช้ออก token ให้เครื่องที่ยังต้องใช้งานต่อ (เช่นเครื่องที่เปลี่ยนรหัสผ่าน)
   */
  async revokeAllForUser(userId: string): Promise<number> {
    const [, user] = await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { sessionVersion: { increment: 1 } },
        select: { sessionVersion: true },
      }),
    ]);
    return user.sessionVersion;
  }

  /**
   * ยกเลิก refresh token ทุกใบของผู้ใช้ (ทุกเครื่อง) โดยไม่แตะ sessionVersion
   * ใช้ตอนระงับบัญชี: access token ที่ถืออยู่ถูก AuthGuard ปฏิเสธจาก status อยู่แล้ว
   */
  revokeAllRefreshTokens(userId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private revokeFamily(familyId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
