import { CLASSIC_STYLE } from "./builtinStyles";
import type { SlideTemplate } from "./types";

/** Default slide template — Claude community palette (coral + cream on dark). */
export function defaultSlideTemplate(): SlideTemplate {
  return {
    ...CLASSIC_STYLE,
    header_text: "Claude Community AU",
    event_date: null,
  };
}
