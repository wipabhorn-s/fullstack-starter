import { AdminService } from '@/admin/admin.service';
import { FindUsersDto } from '@/admin/dto/find-users.dto';
import { UpdateUserStatusDto } from '@/admin/dto/update-user-status.dto';
import { CurrentUser } from '@/common/decorator/current-user.decorator';
import { Roles } from '@/common/decorator/roles.decorator';
import { Role } from '@/database/generated/prisma/enums';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';

// ติดที่ระดับ class: ทุก endpoint ในนี้ RolesGuard ปล่อยเฉพาะ ADMIN
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  findUsers(@Query() query: FindUsersDto) {
    return this.adminService.findUsers(query);
  }

  @Patch('users/:id/status')
  updateUserStatus(
    @CurrentUser('sub') actorId: string,
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(actorId, userId, dto.status);
  }
}
