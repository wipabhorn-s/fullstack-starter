import { DEFAULT_THROTTLE } from '@/common/decorator/throttle.decorator';
import { ClientIpThrottlerGuard } from '@/common/guards/client-ip-throttler.guard';
import { validate } from '@/config/env.validation';
import { HashModule } from '@/infrastructure/hash/hash.module';
import { JwtModule } from '@/infrastructure/jwt/jwt.module';
import { MailModule } from '@/infrastructure/mail/mail.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    // จำกัดคำขอต่อ IP ทุก endpoint (endpoint ที่อ่อนไหวเข้มกว่า ดู throttle.decorator.ts)
    ThrottlerModule.forRoot({
      throttlers: [DEFAULT_THROTTLE],
      errorMessage: 'Too many requests. Please wait a minute and try again.',
    }),
    DatabaseModule,
    HashModule,
    JwtModule,
    MailModule,
  ],
  controllers: [HealthController],
  providers: [
    // ตัวแรกสุด: คำขอที่เกินโควตาถูกตัดก่อนแตะฐานข้อมูล
    { provide: APP_GUARD, useClass: ClientIpThrottlerGuard },
  ],
})
export class AppModule {}
