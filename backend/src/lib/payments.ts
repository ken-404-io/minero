import crypto from "node:crypto";

// Payment provider interface. Swap the MockPaymentProvider for a real
// PayMongo / Xendit / Dragonpay adapter when you have keys + webhook URLs.
//
// Core shape:
//   createCheckout()  — returns URL the frontend redirects to (and a reference)
//   verifyWebhook()   — called by POST /payments/webhook to authenticate a callback
//
// The rest of the app treats all upgrades as pending until verifyWebhook
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

class MockPaymentProvider implements PaymentProvider {
  readonly name = "manual";

  async createCheckout(input: {
    userId: string;
    plan: string;
    amountPhp: number;
    paymentRef?: string;
  }): Promise<Checkout> {
    const reference =
      input.paymentRef && input.paymentRef.length >= 5
        ? input.paymentRef
        : `MOCK-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
    // In prod: this would call PayMongo/Xendit and return their hosted checkout URL.
    return {
      reference,
      redirectUrl: `/plans?pending=1&ref=${encodeURIComponent(reference)}`,
      provider: this.name,
    };
  }

  async verifyWebhook(input: {
    rawBody: string;
    signature: string | null;
  }): Promise<WebhookVerdict> {
    // In prod: verify HMAC signature against provider's shared secret.
    // Here, accept unsigned bodies for local development only.
    if (process.env.NODE_ENV === "production" && !input.signature) {
      return { ok: false, reason: "missing_signature" };
    }
    let parsed: { reference?: unknown; status?: unknown };
    try {
      parsed = JSON.parse(input.rawBody) as typeof parsed;
    } catch {
      return { ok: false, reason: "invalid_json" };
    }
    if (typeof parsed.reference !== "string") return { ok: false, reason: "missing_reference" };
    const status = parsed.status;
    if (status !== "paid" && status !== "failed" && status !== "refunded") {
      return { ok: false, reason: "invalid_status" };
    }
    return {
      ok: true,
      reference: parsed.reference,
      status,
      providerPayload: parsed as Record<string, unknown>,
    };
  }
}

export const paymentProvider: PaymentProvider = new MockPaymentProvider();
