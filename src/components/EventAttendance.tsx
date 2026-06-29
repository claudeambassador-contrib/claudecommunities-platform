import type { ReactNode } from "react";

interface Props {
  event: { lumaUrl?: string | null; rsvpEnabled?: boolean | null };
  children: ReactNode;
}

// Hide the in-app attendance indicator unless there's a meaningful count to
// show: when the event has a Luma URL the count lives on Luma (we'd show 0),
// and when RSVPs aren't enabled there's no way to register at all. Wrap any
// attendance UI in this. `rsvpEnabled` defaults to true so callsites that
// don't pass it preserve the prior behavior.
export function EventAttendance({ event, children }: Props) {
  if (event.lumaUrl) return null;
  if (event.rsvpEnabled === false) return null;
  return <>{children}</>;
}
