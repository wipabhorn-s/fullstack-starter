import { AdminModule } from '@/admin/admin.module';
import { AuthModule } from '@/auth/auth.module';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { DEFAULT_THROTTLE } from '@/common/decorator/throttle.decorator';
import { ClientIpThrottlerGuard } from '@/common/guards/client-ip-throttler.guard';
import { validate } from '@/config/env.validation';
import { HashModule } from '@/infrastructure/hash/hash.module';
import { JwtModule } from '@/infrastructure/jwt/jwt.module';
import { MailModule } from '@/infrastructure/mail/mail.module';
import { UsersModule } from '@/users/users.module';
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
    AuthModule,
    UsersModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [
    // ลำดับมีผล: guard รันตามลำดับที่ประกาศ
    // 1. คำขอที่เกินโควตาถูกตัดก่อนแตะฐานข้อมูล (AuthGuard query ผู้ใช้ทุกครั้ง)
    { provide: APP_GUARD, useClass: ClientIpThrottlerGuard },
    // 2. ทุก route ต้องมี access token ยกเว้น @Public() และบัญชีต้องยังใช้ได้
    { provide: APP_GUARD, useClass: AuthGuard },
    // 3. @Roles(...) ต้องมาหลัง AuthGuard เพราะอ่าน role จาก request.user
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
