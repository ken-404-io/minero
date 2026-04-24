// SMS provider abstraction. Kept in its own module (rather than inside otp.ts)
// so the queue module can import it without creating a cycle: queue.ts pulls
// the provider here; otp.ts pulls the queue.

export interface SmsProvider {
  readonly name: string;
  send(input: { to: string; message: string }): Promise<void>;
}

class ConsoleSmsProvider implements SmsProvider {
  readonly name = "console";
  async send(input: { to: string; message: string }) {
    // eslint-disable-next-line no-console
    console.log(`[otp:sms ${this.name}] → ${input.to}: ${input.message}`);
  }
}

// Semaphore — https://semaphore.co/. Cheapest SMS for Philippine numbers.
class SemaphoreSmsProvider implements SmsProvider {
  readonly name = "semaphore";
  constructor(
    private readonly apiKey: string,
    private readonly senderName: string,
  ) {}

  async send(input: { to: string; message: string }) {
    const params = new URLSearchParams({
      apikey: this.apiKey,
      number: input.to,
      message: input.message,
      sendername: this.senderName,
    });
    const res = await fetch("https://api.semaphore.co/api/v4/messages", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[otp:sms semaphore] error", res.status, text);
      throw new Error(`Semaphore send failed: ${res.status}`);
    }
  }
}

// Twilio — https://www.twilio.com/. Global fallback.
class TwilioSmsProvider implements SmsProvider {
  readonly name = "twilio";
  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly from: string,
  ) {}

  async send(input: { to: string; message: string }) {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const params = new URLSearchParams({
      To: toE164(input.to),
      From: this.from,
      Body: input.message,
    });
    const basic = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[otp:sms twilio] error", res.status, text);
      throw new Error(`Twilio send failed: ${res.status}`);
    }
  }
}

// PH-local 09XXXXXXXXX → +639XXXXXXXXX. Twilio needs E.164.
function toE164(ph: string): string {
  const trimmed = ph.replace(/\s+/g, "");
  if (trimmed.startsWith("+")) return trimmed;
  if (trimmed.startsWith("09") && trimmed.length === 11) {
    return `+63${trimmed.slice(1)}`;
  }
  return trimmed;
}

function createSmsProvider(): SmsProvider {
  const provider = (process.env.SMS_PROVIDER ?? "").toLowerCase();

  if (provider === "semaphore" && process.env.SEMAPHORE_API_KEY) {
    return new SemaphoreSmsProvider(
      process.env.SEMAPHORE_API_KEY,
      process.env.SEMAPHORE_SENDER_NAME ?? "MINERO",
    );
  }

  if (
    provider === "twilio" &&
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM
  ) {
    return new TwilioSmsProvider(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
      process.env.TWILIO_FROM,
    );
  }

  // Auto-detect: if Semaphore credentials are set and no provider was chosen.
  if (!provider && process.env.SEMAPHORE_API_KEY) {
    return new SemaphoreSmsProvider(
      process.env.SEMAPHORE_API_KEY,
      process.env.SEMAPHORE_SENDER_NAME ?? "MINERO",
    );
  }

  return new ConsoleSmsProvider();
}

export const smsProvider: SmsProvider = createSmsProvider();
