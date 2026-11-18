import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailMessage, IEmailSender } from '../auth.ports';

/**
 * Development only: prints the email (including its link) to the terminal
 * instead of sending it. The config refuses this transport in production.
 */
export class ConsoleEmailSender implements IEmailSender {
  async send(message: EmailMessage): Promise<void> {
    console.log(`\n[email] To: ${message.to}\n[email] Subject: ${message.subject}\n${message.text}\n`);
  }
}

/** Sends real email through any SMTP provider (Resend, SendGrid, Amazon SES, Gmail...). */
export class SmtpEmailSender implements IEmailSender {
  private readonly transporter: Transporter;

  constructor(
    private readonly from: string,
    options: { host: string; port: number; secure: boolean; user?: string; pass?: string },
  ) {
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth: options.user ? { user: options.user, pass: options.pass } : undefined,
    });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({ from: this.from, ...message });
  }
}
