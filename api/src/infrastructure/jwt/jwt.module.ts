import { Global, Module } from '@nestjs/common';
import { JwtModule as NestJwtModule } from '@nestjs/jwt';

@Global()
@Module({
  imports: [NestJwtModule],
  exports: [NestJwtModule],
})
export class JwtModule {}
