import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** ใช้ทั้งขอ access token ใบใหม่ (/auth/refresh) และ Log out (/auth/logout) */
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  refreshToken: string;
}
