import { Logger } from '@nestjs/common';
import { escapeHtml, MailService } from './mail.service';

function serviceWith(env: Record<string, string | undefined>) {
  const config = { get: (key: string) => env[key] };
  return new MailService(config as never);
}

const baseEnv = {
  FRONTEND_URL: 'http://localhost:3000/',
  MAIL_FROM_NAME: 'My App',
};

describe('MailService', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue(new Response('{}'));
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ไม่มี BREVO_API_KEY = พิมพ์ลง console ไม่ยิง HTTP', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    await serviceWith(baseEnv).sendWelcome('a@example.com', 'Ann');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('a@example.com'));
  });

  it('มี key = ส่งผ่าน Brevo และแยกอีเมลผู้ส่งออกจากรูป "ชื่อ <a@b.com>"', async () => {
    await serviceWith({
      ...baseEnv,
      BREVO_API_KEY: 'key',
      MAIL_FROM: 'My App <no-reply@example.com>',
    }).sendWelcome('a@example.com', 'Ann');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      sender: { email: string };
      htmlContent: string;
    };
    expect(body.sender.email).toBe('no-reply@example.com');
    // FRONTEND_URL มี / ปิดท้าย ลิงก์ต้องไม่กลายเป็น //dashboard
    expect(body.htmlContent).toContain('http://localhost:3000/dashboard');
  });

  it('โยน error พร้อมรายละเอียดเมื่อ Brevo ตอบไม่สำเร็จ', async () => {
    fetchMock.mockResolvedValue(new Response('bad sender', { status: 400 }));

    await expect(
      serviceWith({
        ...baseEnv,
        BREVO_API_KEY: 'key',
        MAIL_FROM: 'no-reply@example.com',
      }).sendWelcome('a@example.com', 'Ann'),
    ).rejects.toThrow('bad sender');
  });

  it('escape ชื่อที่ผู้ใช้พิมพ์เองก่อนใส่ใน HTML', () => {
    expect(escapeHtml('<b>"x"</b>')).toBe('&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
  });
});
