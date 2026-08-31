import nodemailer, { type Transporter } from 'nodemailer';

export interface MailOptions {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  appName: string;
}

export class MailService {
  private transporter: Transporter | null = null;

  constructor(private readonly opts: MailOptions) {
    if (opts.host) {
      this.transporter = nodemailer.createTransport({
        host: opts.host,
        port: opts.port,
        secure: opts.port === 465,
        auth: opts.user ? { user: opts.user, pass: opts.password } : undefined,
      });
    }
  }

  /** 未配置 SMTP 时打印到日志（与旧行为一致），不阻塞注册流程 */
  async sendInitialPassword(email: string, password: string): Promise<void> {
    const subject = `${this.opts.appName} 注册成功 - 初始密码`;
    const text = `欢迎加入 ${this.opts.appName}！\n\n你的初始密码：${password}\n\n请登录后及时修改资料。`;
    if (!this.transporter) {
      console.warn(`[mail:fallback] to=${email} password=${password}`);
      return;
    }
    try {
      await this.transporter.sendMail({
        from: this.opts.from || this.opts.user,
        to: email,
        subject,
        text,
      });
    } catch (err) {
      console.error('[mail] send failed:', err);
      console.warn(`[mail:fallback] to=${email} password=${password}`);
    }
  }
}
