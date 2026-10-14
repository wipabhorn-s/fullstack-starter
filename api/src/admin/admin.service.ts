import { FindUsersDto } from '@/admin/dto/find-users.dto';
import { RefreshTokenService } from '@/auth/refresh-token.service';
import { Prisma } from '@/database/generated/prisma/client';
import { UserStatus } from '@/database/generated/prisma/enums';
import { PrismaService } from '@/database/prisma.service';
import { PUBLIC_USER_SELECT } from '@/users/users.service';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  async findUsers({ search, page, limit }: FindUsersDto) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: PUBLIC_USER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /**
   * ระงับ: AuthGuard ปฏิเสธ access token ที่ถืออยู่ตั้งแต่คำขอถัดไป (403
   * ACCOUNT_SUSPENDED) และยกเลิก refresh token ทุกใบ จึงต่ออายุไม่ได้อีก
   *
   * ไม่เพิ่ม sessionVersion: ถ้าเพิ่ม AuthGuard จะตอบ 401 SESSION_INVALID แทน
   * แล้วเว็บแยกไม่ออกว่าโดนระงับ ผู้ใช้จะเห็นแค่ "session หมดอายุ"
   */
  async updateUserStatus(actorId: string, userId: string, status: UserStatus) {
    if (actorId === userId) {
      // กันแอดมินระงับตัวเองแล้วไม่มีใครปลดให้
      throw new BadRequestException('You cannot change your own status');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status },
      select: PUBLIC_USER_SELECT,
    });

    if (status === UserStatus.SUSPENDED) {
      await this.refreshTokenService.revokeAllRefreshTokens(userId);
    }

    return updated;
  }
}
