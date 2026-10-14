import { AuthService } from '@/auth/auth.service';
import { GoogleLoginDto } from '@/auth/dto/google-login.dto';
import { LoginDto } from '@/auth/dto/login.dto';
import { RefreshTokenDto } from '@/auth/dto/refresh-token.dto';
import { RegisterDto } from '@/auth/dto/register.dto';
import { Public } from '@/common/decorator/public.decorator';
import {
  CredentialThrottle,
  EmailThrottle,
  RefreshThrottle,
} from '@/common/decorator/throttle.decorator';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ส่งอีเมลต้อนรับออกไป จึงใช้โควตาแบบส่งเมล
  @EmailThrottle()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @HttpCode(HttpStatus.OK)
  @CredentialThrottle()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @HttpCode(HttpStatus.OK)
  @CredentialThrottle()
  @Post('google')
  loginWithGoogle(@Body() dto: GoogleLoginDto) {
    return this.authService.loginWithGoogle(dto);
  }

  /** แลก refresh token เป็น access token ใบใหม่ (ไม่ต้องล็อกอินซ้ำ) */
  @HttpCode(HttpStatus.OK)
  @RefreshThrottle()
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  /** Log out เครื่องนี้ (ไม่ต้องมี access token เพราะอาจหมดอายุแล้ว) */
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto);
  }
}
