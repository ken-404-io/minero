export interface EmailProvider {
  send(params: { to: string; subject: string; html: string }): Promise<void>;
}

// ── Resend provider (fetch-based, no extra package) ──────────────────────────

class ResendProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(params: { to: string; subject: string; html: string }) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...params, from: this.from, to: params.to }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[email] Resend error:", res.status, text);
    }
  }
}

// ── Console fallback (dev / no credentials set) ───────────────────────────────

class ConsoleProvider implements EmailProvider {
  async send(params: { to: string; subject: string }) {
    console.log(`[email:console] → ${params.to} | ${params.subject}`);
  }
}

export const emailProvider: EmailProvider = process.env.RESEND_API_KEY
  ? new ResendProvider(
      process.env.RESEND_API_KEY,
      process.env.EMAIL_FROM ?? "Minero <noreply@minero.app>",
    )
  : new ConsoleProvider();

// ── Email templates ───────────────────────────────────────────────────────────

function layout(title: string, body: string): string {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:520px;margin:40px auto;color:#111">
<h2 style="color:#16a34a">${title}</h2>${body}
<hr style="margin-top:32px;border:none;border-top:1px solid #e5e7eb"/>
<p style="color:#6b7280;font-size:13px">— The Minero Team · <a href="https://minero.app" style="color:#16a34a">minero.app</a></p>
</body></html>`;
}

export function withdrawalSubmittedHtml(params: { name: string; amount: number; method: string }): string {
  return layout(
    "Withdrawal Received",
    `<p>Hi ${params.name},</p>
<p>Your withdrawal request of <strong>₱${params.amount.toFixed(2)}</strong> via <strong>${params.method.toUpperCase()}</strong> has been received and is under review.</p>
<p>We typically process withdrawals within <strong>24–72 hours</strong>. You'll get another email when it's done.</p>`,
  );
}

export function withdrawalApprovedHtml(params: { name: string; amount: number; method: string; accountNumber: string }): string {
  return layout(
    "Withdrawal Approved ✓",
    `<p>Hi ${params.name},</p>
<p>Your withdrawal of <strong>₱${params.amount.toFixed(2)}</strong> via <strong>${params.method.toUpperCase()}</strong> to account ending in <strong>${params.accountNumber.slice(-4)}</strong> has been <strong style="color:#16a34a">approved</strong> and is being processed.</p>
<p>Funds typically arrive within a few hours depending on your e-wallet provider.</p>`,
  );
}

export function withdrawalRejectedHtml(params: { name: string; amount: number; adminNote?: string | null }): string {
  return layout(
    "Withdrawal Update",
    `<p>Hi ${params.name},</p>
<p>Unfortunately your withdrawal of <strong>₱${params.amount.toFixed(2)}</strong> could not be processed at this time.</p>
${params.adminNote ? `<p><strong>Reason:</strong> ${params.adminNote}</p>` : ""}
<p>Your balance has been fully refunded. If you believe this is an error, please contact support.</p>`,
  );
}
