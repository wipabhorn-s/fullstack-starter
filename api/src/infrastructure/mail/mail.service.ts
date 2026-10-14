import { EnvVariable } from '@/config/env.validation';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Brevo transactional email API — HTTPS ล้วน ไม่ใช่ SMTP */
const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

const SEND_TIMEOUT_MS = 10_000;

/** ข้อความที่ผู้ใช้พิมพ์เอง (เช่นชื่อ) ต้อง escape ก่อนใส่ใน HTML ของอีเมล */
export const escapeHtml = (text: string) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

/**
 * ใช้ HTTP API ของ Brevo แทน SMTP เพราะผู้ให้บริการโฮสต์ส่วนใหญ่ (Railway,
 * Render) ปิด outbound SMTP port 25/465/587 ไว้ nodemailer จึงต่อไม่ติดบน
 * production แล้วเมลไม่เคยถูกส่งออกเลยโดยไม่มี error
 *
 * ไม่มี BREVO_API_KEY (dev) = พิมพ์อีเมลลง console แทน คนที่เพิ่ง clone
 * ไม่ต้องหา key มาใส่ก็ทดสอบ flow ที่ส่งเมลได้ ส่วน production
 * env.validation.ts บังคับให้มี key ตั้งแต่ตอน boot จึงไม่ตกมาทางนี้
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly configService: ConfigService<EnvVariable, true>,
  ) {}

  private get frontendUrl(): string {
    return this.configService
      .get('FRONTEND_URL', { infer: true })
      .replace(/\/$/, '');
  }

  private get appName(): string {
    return this.configService.get('MAIL_FROM_NAME', { infer: true });
  }

  /**
   * Brevo ต้องการอีเมลผู้ส่งเป็นค่าเปล่า ๆ ในฟิลด์ของมันเอง แต่ MAIL_FROM
   * อาจถูกตั้งในรูป `ชื่อ <a@b.com>` ตามธรรมเนียมของ SMTP จึงต้องแยกออกจากกัน
   * ก่อนส่ง ไม่งั้น Brevo ตอบ 400 ว่าอีเมลไม่ถูกต้อง
   */
  private sender(from: string): { email: string; name: string } {
    const angled = /^(.*)<\s*([^>]+)\s*>$/.exec(from.trim());
    return {
      email: angled ? angled[2].trim() : from.trim(),
      name: this.appName,
    };
  }

  private layout(heading: string, body: string): string {
    return `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
  <h1 style="font-size:20px;margin:0 0 16px">${heading}</h1>
  ${body}
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
  <p style="font-size:12px;color:#64748b;margin:0">${escapeHtml(this.appName)}</p>
</div>`;
  }

  private button(url: string, label: string): string {
    // ลิงก์ตัวหนังสือต่อท้ายด้วยเสมอ เพราะ mail client บางตัวตัดปุ่มที่เป็น
    // background-color ทิ้ง แล้วผู้รับจะเหลือเมลที่กดอะไรไม่ได้เลย
    return `<p style="margin:0 0 16px"><a href="${url}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600">${label}</a></p>
  <p style="font-size:12px;color:#64748b;margin:0 0 16px">Or open this link: <a href="${url}" style="color:#0f172a;word-break:break-all">${url}</a></p>`;
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    const apiKey = this.configService.get('BREVO_API_KEY', { infer: true });
    const from = this.configService.get('MAIL_FROM', { infer: true });

    if (!apiKey || !from) {
      this.logger.log(
        `[console mail — ตั้ง BREVO_API_KEY + MAIL_FROM เพื่อส่งจริง]\nTo: ${to}\nSubject: ${subject}\n\n${html}`,
      );
      return;
    }

    const response = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: this.sender(from),
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });

    if (!response.ok) {
      // เนื้อ error ของ Brevo บอกสาเหตุตรง ๆ (key ผิด, sender ยังไม่ verify,
      // โควตาวันนี้เต็ม) จึงพาไปด้วยเพื่อไม่ต้องเดาจาก status code เปล่า ๆ
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Brevo ตอบกลับ ${response.status}: ${detail.slice(0, 500)}`,
      );
    }
  }

  async sendWelcome(to: string, name: string) {
    await this.send(
      to,
      `Welcome to ${this.appName}`,
      this.layout(
        `Welcome, ${escapeHtml(name)}!`,
        `<p style="margin:0 0 16px">Your account is ready.</p>
  ${this.button(`${this.frontendUrl}/dashboard`, 'Go to dashboard')}`,
      ),
    );
  }
}
