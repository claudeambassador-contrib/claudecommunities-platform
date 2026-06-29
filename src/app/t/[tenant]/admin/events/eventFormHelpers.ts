/**
 * Helpers shared between the events list page and the event editor modal.
 * Kept in one spot so both forms agree on timezone handling and the city list.
 */

import { getRegionConfig } from "@/lib/region";

// Region-aware so the form's region-derived default timezone always has a
// matching <option> (e.g. Pacific/Auckland on the NZ deploy).
export const TIMEZONE_OPTIONS = getRegionConfig().timezoneOptions;

/** Convert a datetime-local string ("2025-03-15T18:00") in the given tz to a UTC ISO string. */
export function localToUTC(localStr: string, tz: string): string {
  const [datePart, timePart] = localStr.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, min] = timePart.split(":").map(Number);
  const utcGuess = new Date(Date.UTC(y, m - 1, d, h, min));
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(utcGuess);
  const g = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  let tzH = g("hour");
  if (tzH === 24) tzH = 0;
  const tzDate = new Date(Date.UTC(g("year"), g("month") - 1, g("day"), tzH, g("minute")));
  return new Date(utcGuess.getTime() - (tzDate.getTime() - utcGuess.getTime())).toISOString();
}

/** Convert a UTC ISO string to a datetime-local string in the given tz. */
export function utcToLocal(isoString: string, tz: string): string {
  const date = new Date(isoString);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const g = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  let h = g("hour");
  if (h === "24") h = "00";
  return `${g("year")}-${g("month")}-${g("day")}T${h}:${g("minute")}`;
}
