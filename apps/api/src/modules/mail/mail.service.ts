import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('SMTP_PORT', 587),
        secure: this.config.get<number>('SMTP_PORT', 587) === 465,
        auth: {
          user: this.config.get('SMTP_USER'),
          pass: this.config.get('SMTP_PASS'),
        },
      });
    }
  }

  async sendPasswordReset(to: string, resetUrl: string, firstName: string): Promise<void> {
    const subject = 'Reset your CBT Platform password';
    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Password Reset</h2>
        <p>Hi ${firstName},</p>
        <p>We received a request to reset your password. Click the button below — this link expires in 1 hour.</p>
        <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
          Reset Password
        </a>
        <p style="margin-top:24px;color:#666;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `;
    await this.send(to, subject, html);
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    const from = this.config.get('SMTP_FROM', 'noreply@cbt-platform.com');

    if (!this.transporter) {
      this.logger.log(`[DEV MAIL] To: ${to} | Subject: ${subject}`);
      this.logger.log(`[DEV MAIL] Body preview: ${html.replace(/<[^>]+>/g, '').slice(0, 200)}...`);
      return;
    }

    await this.transporter.sendMail({ from, to, subject, html });
  }
}
