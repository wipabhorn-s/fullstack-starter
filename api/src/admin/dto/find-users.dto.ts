import { Trim } from '@/common/decorator/trim.decorator';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class FindUsersDto {
  /** ค้นจากชื่อหรืออีเมล (ไม่สนตัวพิมพ์) */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  search?: string;

  // query string มาเป็น string เสมอ @Type แปลงเป็นตัวเลขก่อนตรวจ
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
