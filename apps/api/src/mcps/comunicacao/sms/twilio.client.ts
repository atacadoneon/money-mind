import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Twilio SMS client stub */
@Injectable()
export class TwilioClient {
  private readonly logger = new Logger(TwilioClient.name);
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly fromNumber: string;

  constructor(private readonly config: ConfigService) {
    this.accountSid = config.get<string>('TWILIO_ACCOUNT_SID', '');
    this.authToken = config.get<string>('TWILIO_AUTH_TOKEN', '');
    this.fromNumber = config.get<string>('TWILIO_FROM_NUMBER', '');
  }

  async sendSms(to: string, body: string): Promise<{ sid?: string; status: 'sent' | 'error'; error?: string }> {
    if (!this.accountSid || !this.authToken) {
      this.logger.warn('Twilio credentials not configured');
      return { status: 'error', error: 'credentials missing' };
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const params = new URLSearchParams({ To: to, From: this.fromNumber, Body: body });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      return { status: 'error', error: `${res.status}: ${text}` };
    }

    const data = await res.json() as { sid?: string };
    return { sid: data.sid, status: 'sent' };
  }
}
