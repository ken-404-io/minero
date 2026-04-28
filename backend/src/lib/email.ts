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

function appUrl(): string {
  return (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
}

function appDisplayUrl(): string {
  return appUrl().replace(/^https?:\/\//, "") || "minero";
}

function layout(title: string, body: string): string {
  const url = appUrl();
  const display = appDisplayUrl();
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:520px;margin:40px auto;color:#111">
<h2 style="color:#16a34a">${title}</h2>${body}
<hr style="margin-top:32px;border:none;border-top:1px solid #e5e7eb"/>
<p style="color:#6b7280;font-size:13px">— The Minero Team${url ? ` · <a href="${url}" style="color:#16a34a">${display}</a>` : ""}</p>
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

export function welcomeHtml(params: { name: string; referralCode: string; appUrl: string }): string {
  return layout(
    "Welcome to Minero 🎉",
    `<p>Hi ${escapeHtml(params.name)},</p>
<p>Your account is ready. A few things to get you started:</p>
<ul>
  <li><strong>Mine</strong> — claim your mining reward every 10 minutes.</li>
  <li><strong>Play</strong> — earn game coins and redeem them for peso.</li>
  <li><strong>Refer</strong> — share your code <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-family:ui-monospace,Menlo,monospace">${escapeHtml(params.referralCode)}</code> and earn a 10% commission on every friend who signs up.</li>
</ul>
<p style="margin-top:24px"><a href="${params.appUrl}" style="background:#16a34a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600">Go to your dashboard</a></p>`,
  );
}

export function planUpgradedHtml(params: { name: string; amountPaid: number }): string {
  return layout(
    "Upgrade Confirmed — Welcome to Ad-Free",
    `<p>Hi ${escapeHtml(params.name)},</p>
<p>We've received your payment of <strong>₱${params.amountPaid.toFixed(2)}</strong>. Your account is now on the <strong>Ad-Free</strong> plan.</p>
<p>What changes:</p>
<ul>
  <li>No more ads before claiming.</li>
  <li>Same claim rate and daily cap — you're just not watching ads anymore.</li>
</ul>
<p>Thanks for supporting Minero.</p>`,
  );
}

export function passwordResetHtml(params: { code: string; ttlMinutes: number }): string {
  return layout(
    "Reset your Minero password",
    `<p>We received a request to reset the password on your Minero account.</p>
<p>Enter this code on the reset page:</p>
<p style="font-size:32px;letter-spacing:8px;font-weight:700;font-family:ui-monospace,Menlo,monospace;background:#f3f4f6;padding:14px 20px;border-radius:8px;display:inline-block;letter-spacing:0.15em">${params.code}</p>
<p style="color:#6b7280">This code expires in <strong>${params.ttlMinutes} minutes</strong>. If you did not request a password reset, you can safely ignore this email — your password will not change.</p>`,
  );
}

// Minimal HTML escaper for names / codes that flow into email bodies.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
