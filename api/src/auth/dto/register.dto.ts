import { NormalizeEmail } from '@/common/decorator/normalize-email.decorator';
import { StrongPassword } from '@/common/decorator/strong-password.decorator';
import { Trim } from '@/common/decorator/trim.decorator';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RegisterDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @StrongPassword()
  password: string;
}
