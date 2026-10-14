import { Public } from '@/common/decorator/public.decorator';
import { PrismaService } from '@/database/prisma.service';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

/**
 * ให้ hosting เช็กว่า API พร้อมรับคำขอแล้ว: ต่อฐานข้อมูลได้ด้วย ไม่ใช่แค่ process ยังไม่ตาย
 * ไม่ตอบข้อมูลภายในใด ๆ
 */
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('Database unavailable');
    }
    return { status: 'ok' };
  }
}
