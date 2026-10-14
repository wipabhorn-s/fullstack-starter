import { EnvVariable } from '@/config/env.validation';
import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client, TokenPayload } from 'google-auth-library';

export type GoogleProfile = {
  googleId: string;
  email: string;
  name: string;
};

/**
 * ตรวจ id_token ที่เว็บได้มาจาก Google (next-auth Google provider ทำ OAuth ให้)
 * API ไม่ต้องรู้ client secret ใช้แค่ client id ตรวจว่า token ออกให้แอปเราจริง
 */
@Injectable()
export class GoogleAuthService {
  private readonly clientId?: string;
  private readonly client?: OAuth2Client;

  constructor(
    private readonly configService: ConfigService<EnvVariable, true>,
  ) {
    this.clientId = this.configService.get('GOOGLE_CLIENT_ID', {
      infer: true,
    });
    if (this.clientId) this.client = new OAuth2Client(this.clientId);
  }

  async verify(idToken: string): Promise<GoogleProfile> {
    // ไม่ตั้ง GOOGLE_CLIENT_ID = ปิดล็อกอินด้วย Google (ไม่ใช่ token ผิด)
    if (!this.client || !this.clientId) {
      throw new ServiceUnavailableException({
        message: 'Google login is not configured',
        code: 'GOOGLE_DISABLED',
      });
    }

    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }

    // รับเฉพาะอีเมลที่ Google ยืนยันแล้ว ไม่งั้นจะเป็นช่องให้ยึดบัญชีคนอื่น
    // (AuthService ผูก Google เข้าบัญชีเดิมที่อีเมลตรงกัน)
    if (!payload?.email || !payload.email_verified) {
      throw new UnauthorizedException('Google account email is not verified');
    }

    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name ?? payload.email.split('@')[0],
    };
  }
}
