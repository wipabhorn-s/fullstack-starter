import { NormalizeEmail } from '@/common/decorator/normalize-email.decorator';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * ไม่ตรวจรูปแบบอีเมล/ความแข็งแรงรหัสผ่านตอนล็อกอิน: ผิดรูปแบบก็แค่ไม่เจอบัญชี
 * ตอบ "Invalid email or password" เหมือนกรณีอื่น (ไม่บอกใบ้ว่าผิดตรงไหน)
 */
export class LoginDto {
  @NormalizeEmail()
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password: string;
}
