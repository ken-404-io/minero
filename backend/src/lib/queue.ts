import { PgBoss } from "pg-boss";
import type { Job } from "pg-boss";
import { emailProvider } from "./email.js";
import { smsProvider } from "./sms.js";

// Async job queue backed by Postgres (pg-boss). Takes long-running or
// retry-able side effects (email, SMS, webhook reconciliation) off the
// request path and gives them automatic exponential-backoff retries.
//
// Jobs are published from route handlers via `enqueue(...)` and consumed
// in-process by workers registered in `startQueue()`. Workers run in the
// same Node process as the API today; they can be split out to a separate
// worker deployment later by importing `startQueue` from a different entry.
//
// The queue uses `DATABASE_URL_UNPOOLED` when available — pg-boss relies
// on long-lived connections for LISTEN/NOTIFY and advisory locks, which
// don't work reliably through pgbouncer transaction-mode poolers.

export const QUEUE_EMAIL = "email:send";
export const QUEUE_SMS = "sms:send";

type EmailJob = { to: string; subject: string; html: string };
type SmsJob = { to: string; message: string };

let boss: PgBoss | null = null;
let starting: Promise<PgBoss | null> | null = null;

function queueConnectionString(): string | undefined {
  return process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
}

function queueDisabled(): boolean {
  return process.env.QUEUE_DISABLED === "true";
}

// Retry every email/SMS job up to 3 times with exponential backoff. These
// options are attached per-job at send() time and per-queue at create time,
// so any transient provider failure self-heals without manual intervention.
const RETRY_POLICY = {
  retryLimit: 3,
  retryDelay: 5, // seconds
  retryBackoff: true,
};

/**
 * Lazily start pg-boss. Returns the running instance, or null if the queue
 * is intentionally disabled or failed to start (callers fall back to
 * synchronous execution when null).
 */
export async function startQueue(): Promise<PgBoss | null> {
  if (boss) return boss;
  if (queueDisabled()) return null;

  const connStr = queueConnectionString();
  if (!connStr) {
    console.warn("[queue] No DATABASE_URL set — running in sync-fallback mode.");
    return null;
  }

  if (!starting) {
    starting = (async () => {
      try {
        const instance = new PgBoss(connStr);

        instance.on("error", (err: Error) => {
          console.error("[queue] pg-boss error:", err);
        });

        await instance.start();
        await instance.createQueue(QUEUE_EMAIL, RETRY_POLICY);
        await instance.createQueue(QUEUE_SMS, RETRY_POLICY);

        await instance.work<EmailJob>(
          QUEUE_EMAIL,
          { localConcurrency: 5 },
          async ([job]: Job<EmailJob>[]) => {
            await emailProvider.send(job.data);
          },
        );

        await instance.work<SmsJob>(
          QUEUE_SMS,
          { localConcurrency: 5 },
          async ([job]: Job<SmsJob>[]) => {
            await smsProvider.send(job.data);
          },
        );

        console.log("[queue] pg-boss started; workers attached for email + sms.");
        boss = instance;
        return instance;
      } catch (err) {
        console.warn("[queue] failed to start, running sync:", err);
        return null;
      }
    })();
  }

  return starting;
}

export async function stopQueue(): Promise<void> {
  if (!boss) return;
  try {
    await boss.stop({ graceful: true });
  } catch (err) {
    console.warn("[queue] error stopping:", err);
  } finally {
    boss = null;
    starting = null;
  }
}

/**
 * Publish a job. Returns fast. Falls back to running the handler
 * synchronously when the queue hasn't started — dev without a DB, tests,
 * or QUEUE_DISABLED=true.
 */
export async function enqueue(
  name: typeof QUEUE_EMAIL,
  data: EmailJob,
): Promise<void>;
export async function enqueue(name: typeof QUEUE_SMS, data: SmsJob): Promise<void>;
export async function enqueue(name: string, data: EmailJob | SmsJob): Promise<void> {
  const instance = boss ?? (await startQueue());
  if (instance) {
    try {
      await instance.send(name, data, RETRY_POLICY);
      return;
    } catch (err) {
      console.warn(`[queue] send(${name}) failed, falling back to sync:`, err);
    }
  }

  // Sync fallback — honour the same interface so callers don't need to care.
  try {
    if (name === QUEUE_EMAIL) {
      await emailProvider.send(data as EmailJob);
    } else if (name === QUEUE_SMS) {
      await smsProvider.send(data as SmsJob);
    }
  } catch (err) {
    console.error(`[queue] sync ${name} failed:`, err);
  }
}
