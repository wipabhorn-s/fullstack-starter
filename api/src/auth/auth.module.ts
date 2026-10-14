import { UsersModule } from '@/users/users.module';
import { Module } from '@nestjs/common';
import { AccessTokenService } from './access-token.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google-auth.service';
import { RefreshTokenService } from './refresh-token.service';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccessTokenService,
    RefreshTokenService,
    GoogleAuthService,
  ],
  // AccessTokenService: AuthGuard ที่ผูกเป็น APP_GUARD ใน AppModule ต้องใช้
  // RefreshTokenService: โมดูลอื่นยกเลิก session ของผู้ใช้ได้ (เช่น AdminModule)
  exports: [AccessTokenService, RefreshTokenService],
})
export class AuthModule {}
