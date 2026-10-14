import { AccessTokenPayload } from '@/auth/types/jwt-payload';
import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { Request } from 'express';

export const CurrentUser = createParamDecorator(
  (data: keyof AccessTokenPayload | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    if (!user) {
      throw new InternalServerErrorException(
        'Current user must be used within AuthGuard',
      );
    }
    return data ? user[data] : user;
  },
);
