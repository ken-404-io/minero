import crypto from "node:crypto";

// Payment provider interface. The PayMongoProvider below talks to the
// PayMongo Checkout Sessions API for a single ₱49 one-time activation fee.
//
// Core shape:
//   createCheckout()  — returns URL the frontend redirects to (and a reference)
//   verifyWebhook()   — called by POST /payments/webhook to authenticate a callback
//
// The rest of the app treats all payments as pending until verifyWebhook
// (or an admin) approves the PlanLog row.

export type Checkout = {
  reference: string;
  redirectUrl: string;
  provider: string;
};

export type WebhookVerdict =
  | { ok: true; reference: string; status: "paid" | "failed" | "refunded"; providerPayload: Record<string, unknown> }
  | { ok: false; reason: string };

export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: {
    userId: string;
    plan: string;
    amountPhp: number;
    paymentRef?: string;
  }): Promise<Checkout>;
  verifyWebhook(input: {
    rawBody: string;
    signature: string | null;
  }): Promise<WebhookVerdict>;
}

const PAYMONGO_API = "https://api.paymongo.com/v1";

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3000"
  );
}

class PayMongoProvider implements PaymentProvider {
  readonly name = "paymongo";

  async createCheckout(input: {
    userId: string;
    plan: string;
    amountPhp: number;
    paymentRef?: string;
  }): Promise<Checkout> {
    const secret = process.env.PAYMONGO_SECRET_KEY;
    if (!secret) throw new Error("PAYMONGO_SECRET_KEY is not configured");

    const auth = "Basic " + Buffer.from(`${secret}:`).toString("base64");
    const base = appUrl().replace(/\/$/, "");
    const body = {
      data: {
        attributes: {
          amount: Math.round(input.amountPhp * 100), // centavos
          currency: "PHP",
          description: `Minero activation fee (${input.plan})`,
          payment_method_types: ["gcash", "card", "paymaya"],
          success_url: `${base}/activate/success`,
          cancel_url: `${base}/activate?cancelled=1`,
          line_items: [
            {
              name: "Minero activation",
              quantity: 1,
              amount: Math.round(input.amountPhp * 100),
              currency: "PHP",
            },
          ],
          metadata: { userId: input.userId, plan: input.plan },
        },
      },
    };

    const res = await fetch(`${PAYMONGO_API}/checkout_sessions`, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`paymongo_checkout_failed: ${res.status} ${text}`);
    }

    const json = JSON.parse(text) as {
      data?: {
        id?: string;
        attributes?: { checkout_url?: string };
      };
    };
    const sessionId = json.data?.id;
    const checkoutUrl = json.data?.attributes?.checkout_url;
    if (!sessionId || !checkoutUrl) {
      throw new Error("paymongo_invalid_response");
    }

    return {
      reference: sessionId,
      redirectUrl: checkoutUrl,
      provider: this.name,
    };
  }

  async verifyWebhook(input: {
    rawBody: string;
    signature: string | null;
  }): Promise<WebhookVerdict> {
    const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
    if (!secret) return { ok: false, reason: "webhook_secret_not_configured" };
    if (!input.signature) return { ok: false, reason: "missing_signature" };

    // PayMongo signature header: "t=<ts>,te=<sig>" (test) or "t=<ts>,li=<sig>" (live).
    const parts = input.signature.split(",").reduce<Record<string, string>>((acc, kv) => {
      const [k, v] = kv.split("=");
      if (k && v) acc[k.trim()] = v.trim();
      return acc;
    }, {});
    const ts = parts.t;
    const sig = parts.te ?? parts.li;
    if (!ts || !sig) return { ok: false, reason: "malformed_signature" };

    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${ts}.${input.rawBody}`)
      .digest("hex");

    const expectedBuf = Buffer.from(expected, "hex");
    const sigBuf = Buffer.from(sig, "hex");
    if (expectedBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expectedBuf, sigBuf)) {
      return { ok: false, reason: "bad_signature" };
    }

    let parsed: {
      data?: {
        attributes?: {
          type?: string;
          data?: {
            id?: string;
            attributes?: Record<string, unknown>;
          };
        };
      };
    };
    try {
      parsed = JSON.parse(input.rawBody);
    } catch {
      return { ok: false, reason: "invalid_json" };
    }

    const eventType = parsed.data?.attributes?.type;
    const inner = parsed.data?.attributes?.data;
    const reference = inner?.id;
    if (!eventType || !reference) return { ok: false, reason: "missing_event_fields" };

    if (eventType === "checkout_session.payment.paid") {
      return {
        ok: true,
        reference,
        status: "paid",
        providerPayload: parsed as unknown as Record<string, unknown>,
      };
    }

    // Any other event: treat as non-paid outcome. The webhook route records it
    // against the pending PlanLog as a rejection.
    return {
      ok: true,
      reference,
      status: "failed",
      providerPayload: parsed as unknown as Record<string, unknown>,
    };
  }
}

export const paymentProvider: PaymentProvider = new PayMongoProvider();
