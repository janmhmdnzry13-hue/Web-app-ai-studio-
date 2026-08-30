import nodemailer, { Transporter, SendMailOptions, SentMessageInfo } from 'nodemailer';

/**
 * ORIGIN Secure Email Delivery Abstraction
 * 
 * Provides a modular, provider-agnostic interface for dispatching transactional
 * system emails (e.g. password resets, security alerts) across multiple backends:
 * - SMTP (Nodemailer / relay server)
 * - SendGrid v3 API
 * - Generic Webhook Relay (e.g., Zapier, Make, custom HTTPS gateway)
 * - Console / Development Sandbox (safe development fallback)
 * 
 * SECURITY MANDATES:
 * 1. NEVER log plaintext reset tokens or raw reset URLs to console/logs.
 * 2. NEVER expose the generated resetToken in API payloads.
 * 3. Handle email dispatch failures gracefully without leaking user existence.
 */

export interface EmailMessage {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailProvider {
  readonly name: string;
  sendEmail(message: EmailMessage): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

/**
 * SendGrid v3 Mail Delivery Provider
 */
export class SendGridEmailProvider implements EmailProvider {
  readonly name = 'sendgrid';
  private apiKey: string;
  private defaultFrom: string;

  constructor(apiKey: string, defaultFrom: string) {
    this.apiKey = apiKey;
    this.defaultFrom = defaultFrom;
  }

  async sendEmail(message: EmailMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: message.to }] }],
          from: { email: message.from || this.defaultFrom },
          subject: message.subject,
          content: [
            { type: 'text/plain', value: message.text },
            { type: 'text/html', value: message.html },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        return { success: false, error: `SendGrid API returned status ${response.status}: ${errText}` };
      }

      const messageId = response.headers.get('x-message-id') || `sg_${Date.now()}`;
      return { success: true, messageId };
    } catch (err: any) {
      return { success: false, error: err.message || 'SendGrid network error' };
    }
  }
}

/**
 * Webhook Email Relay Provider
 */
export class WebhookEmailProvider implements EmailProvider {
  readonly name = 'webhook';
  private webhookUrl: string;
  private defaultFrom: string;

  constructor(webhookUrl: string, defaultFrom: string) {
    this.webhookUrl = webhookUrl;
    this.defaultFrom = defaultFrom;
  }

  async sendEmail(message: EmailMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: message.to,
          from: message.from || this.defaultFrom,
          subject: message.subject,
          text: message.text,
          html: message.html,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        return { success: false, error: `Webhook relay returned HTTP ${response.status}` };
      }

      return { success: true, messageId: `wh_${Date.now()}` };
    } catch (err: any) {
      return { success: false, error: err.message || 'Webhook relay network error' };
    }
  }
}

/**
 * Sanitizes error messages to prevent leaking SMTP credentials, passwords, or reset tokens
 */
export function sanitizeEmailError(errorMessage?: string): string {
  if (!errorMessage) return 'Email delivery failed.';
  let sanitized = String(errorMessage);
  
  const smtpPass = process.env.SMTP_PASS;
  if (smtpPass && smtpPass.trim()) {
    sanitized = sanitized.split(smtpPass.trim()).join('[REDACTED_PASSWORD]');
  }
  
  const smtpUser = process.env.SMTP_USER;
  if (smtpUser && smtpUser.trim()) {
    sanitized = sanitized.split(smtpUser.trim()).join('[REDACTED_USER]');
  }
  
  const sendgridKey = process.env.SENDGRID_API_KEY;
  if (sendgridKey && sendgridKey.trim()) {
    sanitized = sanitized.split(sendgridKey.trim()).join('[REDACTED_KEY]');
  }
  
  // Mask any reset tokens that might inadvertently appear in error payloads
  sanitized = sanitized.replace(/rst_[a-zA-Z0-9_-]+/gi, '[REDACTED_TOKEN]');
  return sanitized;
}

export interface SmtpConfig {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  from: string;
  secure?: boolean;
}

/**
 * SMTP Email Provider (Real SMTP transport powered by Nodemailer)
 */
export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp';
  private config: SmtpConfig;
  private transporter: Transporter | null = null;

  constructor(config: SmtpConfig, customTransporter?: Transporter) {
    this.config = {
      ...config,
      host: (config.host || '').trim(),
      port: Number(config.port) || 587,
      from: config.from || 'ORIGIN Security <noreply@origin-os.internal>',
    };
    if (customTransporter) {
      this.transporter = customTransporter;
    }
  }

  public getTransporter(): Transporter | null {
    if (this.transporter) {
      return this.transporter;
    }

    if (!this.config.host) {
      return null;
    }

    const transportOptions: any = {
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure ?? (this.config.port === 465),
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    };

    if (this.config.user && this.config.pass) {
      transportOptions.auth = {
        user: this.config.user,
        pass: this.config.pass,
      };
    }

    this.transporter = nodemailer.createTransport(transportOptions);
    return this.transporter;
  }

  public setTransporterForTesting(transporter: Transporter | null): void {
    this.transporter = transporter;
  }

  public async verifyConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const transporter = this.getTransporter();
      if (!transporter) {
        return { success: false, error: 'SMTP host is not configured' };
      }
      await transporter.verify();
      return { success: true };
    } catch (err: any) {
      const sanitized = sanitizeEmailError(err?.message || 'SMTP connection verification failed');
      return { success: false, error: sanitized };
    }
  }

  async sendEmail(message: EmailMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.config.host) {
      return { success: false, error: 'SMTP host is not configured' };
    }

    if (isNaN(this.config.port) || this.config.port <= 0 || this.config.port > 65535) {
      return { success: false, error: 'SMTP port is invalid' };
    }

    try {
      const transporter = this.getTransporter();
      if (!transporter) {
        return { success: false, error: 'Failed to initialize SMTP transporter' };
      }

      const mailOptions: SendMailOptions = {
        from: message.from || this.config.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      };

      const info: SentMessageInfo = await transporter.sendMail(mailOptions);

      // Verify that the SMTP server accepted the delivery
      if (Array.isArray(info.rejected) && info.rejected.length > 0) {
        const acceptedCount = Array.isArray(info.accepted) ? info.accepted.length : 0;
        if (acceptedCount === 0) {
          return {
            success: false,
            error: 'Message was rejected by the SMTP server for all recipients',
          };
        }
      }

      if (Array.isArray(info.accepted) && info.accepted.length === 0) {
        return {
          success: false,
          error: 'No recipients were accepted by the SMTP server',
        };
      }

      if (!info.messageId) {
        return {
          success: false,
          error: 'SMTP server did not acknowledge message delivery',
        };
      }

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (err: any) {
      const sanitized = sanitizeEmailError(err?.message || 'SMTP delivery failed');
      return {
        success: false,
        error: sanitized,
      };
    }
  }
}

/**
 * Development / Safe Console Email Provider
 * Logs email dispatch events WITHOUT leaking sensitive tokens or credentials
 */
export class DevelopmentEmailProvider implements EmailProvider {
  readonly name = 'development';

  async sendEmail(message: EmailMessage): Promise<{ success: boolean; messageId?: string }> {
    const maskedRecipient = message.to.replace(/(?<=^.).+(?=@)/, (m) => '*'.repeat(m.length));
    console.info(`[Email Service: DEV] Notification queued for recipient: ${maskedRecipient} | Subject: "${message.subject}" | (Raw security tokens omitted for safety)`);
    return { success: true, messageId: `dev_${Date.now()}` };
  }
}

/**
 * Centralized Email Service
 */
export class EmailService {
  private provider: EmailProvider;
  private defaultFrom: string;

  constructor() {
    this.defaultFrom = process.env.EMAIL_FROM || 'ORIGIN Security <noreply@origin-os.internal>';
    this.provider = this.resolveProvider();
  }

  private resolveProvider(): EmailProvider {
    const smtpHost = process.env.SMTP_HOST?.trim();
    if (smtpHost) {
      return new SmtpEmailProvider({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        from: this.defaultFrom,
      });
    }
    if (process.env.SENDGRID_API_KEY?.trim()) {
      return new SendGridEmailProvider(process.env.SENDGRID_API_KEY.trim(), this.defaultFrom);
    }
    if (process.env.EMAIL_WEBHOOK_URL?.trim()) {
      return new WebhookEmailProvider(process.env.EMAIL_WEBHOOK_URL.trim(), this.defaultFrom);
    }
    return new DevelopmentEmailProvider();
  }

  public getProvider(): EmailProvider {
    return this.provider;
  }

  public setProviderForTesting(provider: EmailProvider): void {
    this.provider = provider;
  }

  public resetProvider(): void {
    this.defaultFrom = process.env.EMAIL_FROM || 'ORIGIN Security <noreply@origin-os.internal>';
    this.provider = this.resolveProvider();
  }

  /**
   * Dispatches a single-use password reset email to the given recipient
   */
  public async sendPasswordResetEmail(
    toEmail: string,
    resetToken: string,
    requestOrigin?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const envAppUrl = process.env.APP_URL;
    let baseUrl = 'http://localhost:3000';
    if (envAppUrl) {
      baseUrl = envAppUrl.replace(/\/$/, '');
    } else if (requestOrigin) {
      baseUrl = requestOrigin.startsWith('http')
        ? requestOrigin.replace(/\/$/, '')
        : `https://${requestOrigin.replace(/\/$/, '')}`;
    }

    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

    const subject = 'Reset your ORIGIN password';
    const text = [
      'Hello,',
      '',
      'A password reset request was received for your ORIGIN account.',
      'To set a new password, click the link below or paste it into your browser:',
      '',
      resetUrl,
      '',
      'This link is single-use and will expire in 1 hour.',
      'If you did not request a password reset, you can safely ignore this email.',
      '',
      '— ORIGIN Security Team',
    ].join('\n');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reset Your ORIGIN Password</title>
</head>
<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; color: #18181b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table width="100%" max-width="520px" style="max-width: 520px; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 12px; padding: 32px;" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding-bottom: 20px;">
              <div style="display: inline-block; width: 32px; height: 32px; line-height: 32px; text-align: center; background-color: #18181b; color: #fafafa; border-radius: 8px; font-weight: bold; font-family: monospace; font-size: 16px;">
                O
              </div>
              <span style="font-weight: 700; font-size: 16px; margin-left: 10px; vertical-align: middle; color: #18181b;">ORIGIN</span>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 16px;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #18181b;">Reset your password</h1>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 24px; font-size: 14px; line-height: 1.6; color: #52525b;">
              A password reset request was initiated for your ORIGIN account. Click the button below to establish a new password for your account:
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 24px;">
              <a href="${resetUrl}" style="display: inline-block; background-color: #18181b; color: #fafafa; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 8px;">
                Reset Password
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 20px; font-size: 12px; line-height: 1.5; color: #71717a;">
              This link is valid for 1 hour and can only be used once. If you did not make this request, you can safely disregard this email.
            </td>
          </tr>
          <tr>
            <td style="border-top: 1px solid #f4f4f5; padding-top: 16px; font-size: 11px; color: #a1a1aa; line-height: 1.5; word-break: break-all;">
              Button not working? Copy and paste this URL into your browser:<br/>
              <span style="color: #71717a;">${resetUrl}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return this.provider.sendEmail({
      to: toEmail,
      from: this.defaultFrom,
      subject,
      text,
      html,
    });
  }
}

export const emailService = new EmailService();
