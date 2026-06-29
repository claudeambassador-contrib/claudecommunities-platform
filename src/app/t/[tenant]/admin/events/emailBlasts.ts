/**
 * Pre-fills the morning-of and post-event email blasts admins copy into Luma.
 * Pure functions so they're trivially testable.
 */

export interface EmailBlastInput {
  title: string;
  startTime: string;
  timezone?: string | null;
  location?: string | null;
  feedbackUrl?: string | null;
}

export type EmailBlastKind = "morning-of" | "post-event";

function fmtTime(iso: string, tz: string | null | undefined, lang: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleTimeString(lang, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: tz || undefined,
    });
  } catch {
    return d.toLocaleTimeString(lang, { hour: "numeric", minute: "2-digit", hour12: true });
  }
}

export function renderMorningOfBlast(event: EmailBlastInput, lang: string): string {
  const doorsTime = fmtTime(event.startTime, event.timezone, lang);
  const venue = event.location?.trim() || "the venue";
  return `Hey Clauders,

We're just a few hours away from our next event!

Your plans might have changed - and that's ok - if you can't make it, please update your RSVP on Luma so that we can pass on your spot. There are plenty of people who are on the waitlist.

Otherwise: We'll see you tonight!

Please note: We'll be opening the doors at ${doorsTime || "5:30pm"} at ${venue}, give everyone a little more time to network!

Please have your QR code ready to sign in - we fixed our process - this should be smoother now!

Keep Thinking`;
}

export function renderPostEventBlast(event: EmailBlastInput, siteUrl: string): string {
  const title = event.title?.trim() || "the meetup";
  const survey = event.feedbackUrl?.trim() || "<survey link>";
  return `Hey Clauders!

Thank you for joining ${title} tonight.

A quick feedback goes a long way.

We want to get better and provide you with what you need. And the best way is, if you give us a minute and fill this feedback form:
${survey}

Not yet on our community platform? Consider joining: ${siteUrl} to get first dibs on events!

Keep thinking!`;
}

export function renderBlast(
  event: EmailBlastInput,
  kind: EmailBlastKind,
  ctx: { lang: string; siteUrl: string },
): string {
  return kind === "morning-of"
    ? renderMorningOfBlast(event, ctx.lang)
    : renderPostEventBlast(event, ctx.siteUrl);
}
