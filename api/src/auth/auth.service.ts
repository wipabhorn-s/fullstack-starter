import { AccessTokenService } from '@/auth/access-token.service';
import { GoogleLoginDto } from '@/auth/dto/google-login.dto';
import { LoginDto } from '@/auth/dto/login.dto';
import { RefreshTokenDto } from '@/auth/dto/refresh-token.dto';
import { RegisterDto } from '@/auth/dto/register.dto';
import { GoogleAuthService } from '@/auth/google-auth.service';
import { RefreshTokenService } from '@/auth/refresh-token.service';
import { BcryptService } from '@/infrastructure/hash/bcrypt.service';
import { MailService } from '@/infrastructure/mail/mail.service';
import { SessionUser, UsersService } from '@/users/users.service';
import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * ไม่มีอีเมลนี้ / บัญชี Google ที่ไม่มีรหัสผ่าน / รหัสผิด ตอบข้อความเดียวกันหมด
 * ไม่ให้ใช้หน้าล็อกอินไล่เดาว่าอีเมลไหนมีอยู่ในระบบ
 */
const INVALID_CREDENTIALS = 'Invalid email or password';

const suspended = () =>
  new ForbiddenException({
    message: 'Your account has been suspended',
    code: 'ACCOUNT_SUSPENDED',
  });

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly bcryptService: BcryptService,
    private readonly accessTokenService: AccessTokenService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly googleAuthService: GoogleAuthService,
    private readonly mailService: MailService,
  ) {}

  /** hash ไว้เทียบเล่น ๆ ตอนไม่มีรหัสจริงให้เทียบ ให้ล็อกอินพลาดทุกแบบใช้เวลาเท่ากัน */
  private dummyHash?: Promise<string>;

  private dummyPasswordHash(): Promise<string> {
    this.dummyHash ??= this.bcryptService.hash('dummy-password-for-timing');
    return this.dummyHash;
  }

  private signAccessToken(user: SessionUser) {
    return this.accessTokenService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      ver: user.sessionVersion,
    });
  }

  /** ล็อกอินสำเร็จ: access token อายุสั้น + refresh token ใบแรกของ family ใหม่ */
  private async issueSession(user: SessionUser) {
    const [access_token, refresh_token] = await Promise.all([
      this.signAccessToken(user),
      this.refreshTokenService.issue(user.id),
    ]);

    const { sessionVersion: _version, ...publicUser } = user;
    return { access_token, refresh_token, user: publicUser };
  }

  /**
   * สมัครแล้วได้ session ทันที (template นี้ไม่มีขั้นยืนยันอีเมล)
   *
   * อีเมลซ้ำตอบ 409 EMAIL_TAKEN ซึ่งบอกคนนอกได้ว่าอีเมลนี้มีบัญชี ถ้าเพิ่ม
   * การยืนยันอีเมลทีหลัง ให้ตอบสำเร็จเหมือนกันทุกกรณีแล้วแจ้งเจ้าของทางอีเมลแทน
   */
  async register(dto: RegisterDto) {
    const user = await this.usersService.create(dto);

    // เมลไม่ออกไม่ควรทำให้สมัครล้ม แถวใน users ถูกสร้างไปแล้ว
    try {
      await this.mailService.sendWelcome(user.email, user.name);
    } catch (error) {
      this.logger.error(`ส่งอีเมลต้อนรับไม่สำเร็จ (${user.id})`, error);
    }

    return this.issueSession(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(dto.email);

    // เทียบ bcrypt กับ hash หลอกเสมอแม้ไม่มีบัญชี เวลาตอบจึงเท่ากันทุกกรณี
    const isMatch = await this.bcryptService.compare(
      dto.password,
      user?.password ?? (await this.dummyPasswordHash()),
    );

    if (!user?.password || !isMatch) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    // เช็กหลังรหัสผ่านถูกแล้วเท่านั้น คนที่รู้รหัสคือเจ้าของ บอกสาเหตุได้
    if (user.status !== 'ACTIVE') throw suspended();

    const { password: _password, ...sessionUser } = user;
    return this.issueSession(sessionUser);
  }

  async loginWithGoogle(dto: GoogleLoginDto) {
    const profile = await this.googleAuthService.verify(dto.idToken);

    const user =
      (await this.usersService.findByGoogleId(profile.googleId)) ??
      (await this.usersService.upsertGoogleUser(profile));

    if (user.status !== 'ACTIVE') throw suspended();

    return this.issueSession(user);
  }

  /**
   * แลก refresh token เป็น access token ใบใหม่ (และ refresh token ใบใหม่)
   * ดึงข้อมูลผู้ใช้ล่าสุดทุกครั้ง role ที่เปลี่ยนไปจึงมาถึงเว็บเองโดยไม่ต้องล็อกอินใหม่
   */
  async refresh(dto: RefreshTokenDto) {
    const { userId, refreshToken } = await this.refreshTokenService.rotate(
      dto.refreshToken,
    );

    const user = await this.usersService.findById(userId);
    if (!user || user.status !== 'ACTIVE') {
      // ใบที่เพิ่งออกให้ก็ต้องทิ้งด้วย ไม่งั้นยังวนต่ออายุได้เรื่อย ๆ
      await this.refreshTokenService.revoke(refreshToken);
      if (user) throw suspended();
      throw new UnauthorizedException({
        message: 'Your session is no longer valid. Please log in again.',
        code: 'SESSION_INVALID',
      });
    }

    const { sessionVersion: _version, ...publicUser } = user;
    return {
      access_token: await this.signAccessToken(user),
      refresh_token: refreshToken,
      user: publicUser,
    };
  }

  /** Log out เครื่องนี้: ยกเลิก refresh token ของ session นี้ */
  async logout(dto: RefreshTokenDto) {
    await this.refreshTokenService.revoke(dto.refreshToken);
    return { message: 'Logged out' };
  }
}
