import type { SlideTemplate } from "./types";

/**
 * Full visual styles for the two named built-in looks. Picking "Classic" or
 * "Centered" in the layout picker applies one of these on top of the user's
 * current header_text / event_date — overriding aspect ratio, colours, fonts,
 * sizes, AND element positions. Captured from the staging working state so
 * the dragged element layout the designer set up is reproduced exactly.
 */
type BuiltinStyle = Omit<SlideTemplate, "header_text" | "event_date">;

export const CLASSIC_STYLE: BuiltinStyle = {
  aspect_ratio: "4:3",
  layout: "bottom-left",
  layout_config: {},

  background_type: "image",
  background_color: "#1C1917",
  background_gradient_from: "#1C1917",
  background_gradient_to: "#2D2926",
  background_image_url: null,
  overlay_opacity: 0.55,

  header_color: "#D4836A",
  header_font_size: 26,
  header_font: "Lora",
  show_header: true,

  event_date_color: "#000000",
  event_date_font_size: 13,
  event_date_font: "Lora",
  show_event_date: true,

  name_color: "#000000",
  name_font_size: 42,
  name_font: "Lora",
  show_name: true,

  title_color: "#5c5c5c",
  title_font_size: 14,
  title_font: "Lora",
  show_title: true,

  description_color: "#000000",
  description_font_size: 29,
  description_font: "Lora",
  show_description: true,
  show_talk_title: true,

  show_headshot: true,
  headshot_shape: "rounded",
  headshot_size: 350,
  headshot_border_visible: true,
  headshot_border_color: "rgba(212,131,106,0.4)",
  headshot_bg_color: "rgba(255,255,255,0.08)",

  show_logo: true,
  show_social: true,

  custom_elements: [],
};

export const CENTERED_STYLE: BuiltinStyle = {
  aspect_ratio: "1:1",
  layout: "centered",
  layout_config: {
    elementPositions: {
      header: {
        x: 21.480495946425453,
        y: 4.999689212148701,
        width: 57.03901720781824,
        height: 5.248198340529385,
        scale: 1,
      },
      eventDate: {
        x: 41.72775566669091,
        y: 10.956138312606711,
        width: 12.666190732005953,
        height: 3.100149200920296,
        scale: 1,
      },
      headshot: {
        x: 32.03280372595956,
        y: 21.154324551521302,
        width: 28.180913658038538,
        height: 28.180913658038538,
        scale: 1,
      },
      name: {
        x: 23.920540055548663,
        y: 53.80840138282847,
        width: 59.31597732586484,
        height: 7.828031571677371,
        scale: 1,
      },
      subtitle: { x: 10, y: 66 },
      talk: {
        x: 20.90581599193244,
        y: 81.02013017961171,
        width: 47.45278186069187,
        height: 9.157554583765881,
        scale: 0.9,
      },
      social: { x: 10, y: 82 },
      logo: { x: 45, y: 82 },
    },
  },

  background_type: "image",
  background_color: "#1C1917",
  background_gradient_from: "#1C1917",
  background_gradient_to: "#2D2926",
  background_image_url: "/images/slide-bg-centered.png",
  overlay_opacity: 0.55,

  header_color: "#000000",
  header_font_size: 22,
  header_font: "Lora",
  show_header: true,

  event_date_color: "#A8A29E",
  event_date_font_size: 13,
  event_date_font: "Lora",
  show_event_date: true,

  name_color: "#FAF9F6",
  name_font_size: 50,
  name_font: "Lora",
  show_name: true,

  title_color: "#A8A29E",
  title_font_size: 14,
  title_font: "Lora",
  show_title: false,

  description_color: "#000000",
  description_font_size: 32,
  description_font: "Lora",
  show_description: true,
  show_talk_title: true,

  show_headshot: true,
  headshot_shape: "circle",
  headshot_size: 270,
  headshot_border_visible: true,
  headshot_border_color: "rgba(212,131,106,0.4)",
  headshot_bg_color: "rgba(255,255,255,0.08)",

  show_logo: true,
  show_social: true,

  custom_elements: [],
};
