import { EnvVariable } from '@/config/env.validation';
import { PrismaClient } from '@/database/generated/prisma/client';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(
    private readonly configService: ConfigService<EnvVariable, true>,
  ) {
    const adapter = new PrismaPg({
      connectionString: configService.get('DATABASE_URL', { infer: true }),
    });
    super({ adapter });
  }

  /** ปิด connection pool ตอนแอปปิด (deploy ใหม่, test จบ) ไม่ให้ค้าง */
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
