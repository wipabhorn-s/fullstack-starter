import { CurrentUser } from '@/common/decorator/current-user.decorator';
import { Controller, Get, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** ข้อมูลล่าสุดจากฐานข้อมูล (session ฝั่งเว็บอาจเก่ากว่านี้) */
  @Get('me')
  async me(@CurrentUser('sub') userId: string) {
    const user = await this.usersService.findPublicById(userId);
    // AuthGuard เช็กบัญชีให้แล้ว มาถึงตรงนี้แล้วไม่เจอ = ถูกลบระหว่างคำขอพอดี
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
