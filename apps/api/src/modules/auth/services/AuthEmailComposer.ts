import type { IAuthSettings } from '../../settings/settings';
import type { EmailMessage } from '../auth.ports';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * Builds the text of every auth email. It only writes messages; sending is
 * IEmailSender's job (Single Responsibility), so wording can change without
 * touching delivery, and vice versa.
 *
 * Tokens go in the URL fragment (#token=...). Browsers never send the fragment
 * to servers or in the Referer header, so the token cannot leak through logs.
 */
export class AuthEmailComposer {
  constructor(
    private readonly settings: Pick<IAuthSettings, 'getBrandName'>,
    private readonly frontendUrl: string,
  ) {}

  async verifyEmail(to: string, token: string): Promise<EmailMessage> {
    const brand = await this.settings.getBrandName();
    return this.build(to, `Confirm your email for ${brand}`, [
      `Welcome to ${brand}!`,
      'Please confirm your email address to activate your account. This link expires in 24 hours.',
    ], 'Confirm my email', `${this.frontendUrl}/verify-email#token=${token}`);
  }

  async resetPassword(to: string, token: string): Promise<EmailMessage> {
    const brand = await this.settings.getBrandName();
    return this.build(to, `Reset your ${brand} password`, [
      'We received a request to reset your password. This link expires in 1 hour.',
      'If you did not ask for this, you can ignore this email. Your password will not change.',
    ], 'Choose a new password', `${this.frontendUrl}/reset-password#token=${token}`);
  }

  /** Sent when someone tries to register an email that already has an account. */
  async accountAlreadyExists(to: string): Promise<EmailMessage> {
    const brand = await this.settings.getBrandName();
    return this.build(to, `You already have a ${brand} account`, [
      'Someone (hopefully you) tried to create a new account with this email address, but you already have one.',
      'You can log in with your password or with Google. If you forgot your password, use "Forgot password" on the login page.',
    ], 'Go to login', `${this.frontendUrl}/login`);
  }

  private build(to: string, subject: string, paragraphs: string[], buttonText: string, link: string): EmailMessage {
    const text = `${paragraphs.join('\n\n')}\n\n${buttonText}: ${link}\n`;
    const html =
      paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('') +
      `<p><a href="${escapeHtml(link)}">${escapeHtml(buttonText)}</a></p>` +
      `<p style="color:#666;font-size:12px">If the button does not work, copy this link into your browser:<br>${escapeHtml(link)}</p>`;
    return { to, subject, text, html };
  }
}
