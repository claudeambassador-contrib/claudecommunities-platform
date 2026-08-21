export interface EmailMessage {
  from: string;
  html: string;
  subject: string;
  to: string;
}

export interface EmailSendResult {
  email: string;
  error?: string;
  id?: string;
  ok: boolean;
}

export interface EmailTransport {
  sendBatch: (messages: EmailMessage[]) => Promise<EmailSendResult[]>;
}

const BATCH_SIZE = 100;

export function chunkMessages(messages: EmailMessage[], size = BATCH_SIZE): EmailMessage[][] {
  const out: EmailMessage[][] = [];
  for (let i = 0; i < messages.length; i += size) {
    out.push(messages.slice(i, i + size));
  }
  return out;
}

export function resendTransportFromEnv(env: Record<string, unknown>): EmailTransport | null {
  const key = String(env.RESEND_API_KEY ?? "").trim();
  if (!key) {
    return null;
  }
  return {
    async sendBatch(messages) {
      const results: EmailSendResult[] = [];
      for (const batch of chunkMessages(messages)) {
        // oxlint-disable-next-line no-await-in-loop -- Resend rate-limits batch POSTs
        const response = await fetch("https://api.resend.com/emails/batch", {
          body: JSON.stringify(
            batch.map((message) => ({
              from: message.from,
              html: message.html,
              subject: message.subject,
              to: [message.to],
            })),
          ),
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        });
        // oxlint-disable-next-line no-await-in-loop -- Resend rate-limits batch POSTs
        const body = (await response.json().catch(() => null)) as {
          data?: { id?: string }[];
          error?: { message?: string };
        } | null;
        if (!response.ok) {
          const error = body?.error?.message ?? `Resend ${response.status}`;
          for (const message of batch) {
            results.push({ email: message.to, error, ok: false });
          }
          continue;
        }
        const data = body?.data ?? [];
        batch.forEach((message, index) => {
          const id = data[index]?.id;
          results.push({ email: message.to, id, ok: Boolean(id) });
        });
      }
      return results;
    },
  };
}
