import { validate } from '@/config/env.validation';
import { Logger } from '@nestjs/common';

const baseEnv = {
  FRONTEND_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/app',
  ACCESS_TOKEN_SECRET: 'x'.repeat(32),
};

describe('env validation', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('boots with only the required values and fills defaults', () => {
    const env = validate(baseEnv);
    expect(env.PORT).toBe(8000);
    expect(env.ACCESS_TOKEN_EXPIRES_IN).toBe(900);
    expect(env.NODE_ENV).toBe('development');
  });

  it('treats blank optional lines from .env.example as unset', () => {
    const env = validate({
      ...baseEnv,
      GOOGLE_CLIENT_ID: '',
      BREVO_API_KEY: '  ',
      INTERNAL_API_SECRET: '',
    });
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(env.BREVO_API_KEY).toBeUndefined();
    expect(env.INTERNAL_API_SECRET).toBeUndefined();
  });

  it('rejects a short access token secret', () => {
    expect(() =>
      validate({ ...baseEnv, ACCESS_TOKEN_SECRET: 'short' }),
    ).toThrow('Env validation failed');
  });

  it('requires mail settings in production', () => {
    expect(() => validate({ ...baseEnv, NODE_ENV: 'production' })).toThrow(
      'Env validation failed',
    );
    expect(() =>
      validate({
        ...baseEnv,
        NODE_ENV: 'production',
        BREVO_API_KEY: 'key',
        MAIL_FROM: 'no-reply@example.com',
      }),
    ).not.toThrow();
  });
});
