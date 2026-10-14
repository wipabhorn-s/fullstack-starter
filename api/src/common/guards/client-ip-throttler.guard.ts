import { resolveClientIp } from '@/common/utils/client-ip';
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

/** rate limit นับต่อ IP จริงของผู้ใช้ (ไม่ใช่ IP ของ server เว็บ) ดู resolveClientIp */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected getTracker(request: Record<string, unknown>): Promise<string> {
    return Promise.resolve(
      resolveClientIp(
        request as unknown as Request,
        process.env.INTERNAL_API_SECRET || undefined,
      ),
    );
  }
}
