import { resolveClientIp } from '@/common/utils/client-ip';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** IP จริงของผู้ใช้ (ดู resolveClientIp) ใช้แทน @Ip() ของ Nest */
export const ClientIp = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    resolveClientIp(
      context.switchToHttp().getRequest<Request>(),
      process.env.INTERNAL_API_SECRET || undefined,
    ),
);
