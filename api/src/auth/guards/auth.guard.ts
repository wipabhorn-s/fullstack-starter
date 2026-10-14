import { AccessTokenService } from '@/auth/access-token.service';
import { IS_PUBLIC_KEY } from '@/common/decorator/public.decorator';
import { PrismaService } from '@/database/prisma.service';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JsonWebTokenError, TokenExpiredError } from '@nestjs/jwt';
import { Request } from 'express';

/**
 * ผูกเป็น APP_GUARD ทุก route ต้องมี access token ยกเว้นที่ติด @Public()
 * (ลำดับใน app.module.ts: ClientIpThrottlerGuard → AuthGuard → RolesGuard)
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly accessTokenService: AccessTokenService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const [bearer, token] = request.headers.authorization?.split(' ') ?? [];
    if (bearer !== 'Bearer' || !token) {
      throw new UnauthorizedException(
        'Missing or invalid authorization header',
      );
    }

    try {
      request.user = await this.accessTokenService.verify(token);
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedException('Token has expired');
      }
      if (error instanceof JsonWebTokenError) {
        throw new UnauthorizedException('Invalid token');
      }
      throw error;
    }

    await this.assertAccountStillUsable(request.user.sub, request.user.ver);
    return true;
  }

  /**
   * access token เป็น JWT ที่ตรวจได้แค่ "ลายเซ็นถูกและยังไม่หมดอายุ" เท่านั้น
   * เพิกถอนกลางคันไม่ได้ ต่างจาก refresh token ที่เก็บเป็นแถวใน DB
   *
   * ถ้าไม่เช็กตรงนี้ บัญชีที่เพิ่งถูกลบหรือถูกระงับจะยังยิง API ได้ต่อจนกว่า
   * token ใบในมือจะหมดอายุ — การ revoke refresh token ปิดแค่การ "ต่ออายุ"
   * ราคาคือ query เดียวต่อคำขอ (primary key, select สองคอลัมน์) ให้คงไว้
   */
  private async assertAccountStillUsable(userId: string, version: number) {
    const account = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { status: true, sessionVersion: true },
    });

    // บัญชีถูกลบ หรือผู้ใช้ถูกยกเลิกทุก session ไปแล้ว (sessionVersion เพิ่มขึ้น)
    // ตอบ 401 ให้เว็บรู้ว่าต้องล็อกเอาต์ ไม่ใช่ 404 กระจัดกระจายตาม endpoint
    if (!account || version !== account.sessionVersion) {
      throw new UnauthorizedException({
        message: 'Your session is no longer valid. Please log in again.',
        code: 'SESSION_INVALID',
      });
    }

    if (account.status !== 'ACTIVE') {
      throw new ForbiddenException({
        message: 'Your account has been suspended',
        code: 'ACCOUNT_SUSPENDED',
      });
    }
  }
}
