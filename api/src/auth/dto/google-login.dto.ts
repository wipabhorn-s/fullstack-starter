import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class GoogleLoginDto {
  /** id_token ที่เว็บได้จาก Google ผ่าน next-auth */
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  idToken: string;
}
