// Block-to-HTML rendering for email campaigns. Lives outside EmailBuilder.tsx
// so server code (campaign send/test/preview routes) can re-render a campaign
// from its stored `blocks` JSON without dragging in React.

import { normalizeFragment } from "./wrap";

export type BlockType =
  | "header"
  | "text"
  | "image"
  | "button"
  | "divider"
  | "spacer"
  | "columns"
  | "social"
  | "html";

export interface EmailBlock {
  id: string;
  type: BlockType;
  props: Record<string, unknown>;
}

/** Per-tenant rendering context. Callers resolve `siteUrl` from the tenant
 * config (`useTenantConfig()` client-side, `(await getTenantConfig())` server-
 * side) so these builders stay pure + client-importable. */
export interface RenderContext {
  siteUrl: string;
}

/** The community logo URL for a tenant's site. */
export function emailLogoUrl(ctx: RenderContext): string {
  return `${ctx.siteUrl}/images/claude-code-logo.webp`;
}

// ─── Block → HTML (Outlook + all major clients compatible) ───────────

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: cognitive complexity is per-function; the per-block-type switch would carry the same score if extracted, so reducing it requires a real decomposition out of scope for a lint pass
export function blockToHtml(block: EmailBlock, ctx: RenderContext): string {
  const p = block.props;
  switch (block.type) {
    case "header": {
      // VML gradient fallback for Outlook, CSS gradient for others
      const bgColor = "#c4775f"; // fallback solid color
      return `<!--[if mso]>
<v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;">
<v:fill type="gradient" color="#D4836A" color2="#c4775f" angle="135" />
<v:textbox style="mso-fit-shape-to-text:true" inset="0,0,0,0">
<![endif]-->
<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
  <tr>
    <td align="center" style="background: ${p.bgGradient}; background-color: ${bgColor}; padding: 32px; text-align: center; border-radius: 16px 16px 0 0;">
      ${
        p.showLogo
          ? `<img src="${emailLogoUrl(ctx)}" alt="Claude Community" width="60" height="60" style="max-width: 60px; height: auto; display: inline-block; border: 0;" />
      <br /><br />`
          : ""
      }
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${p.title}</h1>
      ${p.subtitle ? `<p style="color: #ffffffcc; margin: 8px 0 0; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${p.subtitle}</p>` : ""}
    </td>
  </tr>
</table>
<!--[if mso]></v:textbox></v:rect><![endif]-->`;
    }

    case "text": {
      const lines = String(p.content)
        .split("\n")
        .map(
          (line: string) =>
            `<p style="margin: 0 0 12px 0; color: ${p.color}; font-size: ${p.fontSize}px; line-height: 1.6; text-align: ${p.align}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${line || "&nbsp;"}</p>`,
        )
        .join("\n      ");
      return `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
  <tr>
    <td style="padding: 0 24px;">
      ${lines}
    </td>
  </tr>
</table>`;
    }

    case "image": {
      if (!p.src) return "";
      const widthStr = String(p.width || "100%");
      const widthAttr = widthStr.includes("%") ? widthStr : widthStr.replace("px", "") || "552";
      const imgTag = `<img src="${p.src}" alt="${p.alt || ""}" width="${widthAttr}" style="max-width: 100%; height: auto; display: block; border: 0;${Number(p.borderRadius) > 0 ? ` border-radius: ${p.borderRadius}px;` : ""}${p.align === "center" ? " margin: 0 auto;" : ""}" />`;
      const imgWrapped = p.link
        ? `<a href="${p.link}" target="_blank" style="text-decoration: none;">${imgTag}</a>`
        : imgTag;
      return `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
  <tr>
    <td align="${p.align}" style="padding: 8px 24px;">
      ${imgWrapped}
    </td>
  </tr>
</table>`;
    }

    case "button": {
      // Bulletproof button: works in Outlook via mso padding trick
      const radius = Number(p.borderRadius) || 8;
      return `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
  <tr>
    <td align="${p.align}" style="padding: 8px 24px;">
      <table cellpadding="0" cellspacing="0" border="0" role="presentation"${p.fullWidth ? ' width="100%"' : ""}>
        <tr>
          <td align="center" bgcolor="${p.bgColor}" style="background-color: ${p.bgColor}; border-radius: ${radius}px; mso-padding-alt: 14px 28px;">
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${p.url}" style="height:48px;v-text-anchor:middle;width:200px;" arcsize="${Math.round((radius / 48) * 100)}%" strokecolor="${p.bgColor}" fillcolor="${p.bgColor}">
            <w:anchorlock/>
            <center style="color:${p.textColor};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;font-weight:600;">
            ${p.text}
            </center>
            </v:roundrect>
            <![endif]-->
            <!--[if !mso]><!-->
            <a href="${p.url}" style="display: ${p.fullWidth ? "block" : "inline-block"}; background-color: ${p.bgColor}; color: ${p.textColor}; padding: 14px 28px; border-radius: ${radius}px; text-decoration: none; font-weight: 600; font-size: 16px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; mso-hide: all;">${p.text}</a>
            <!--<![endif]-->
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
    }

    case "divider":
      return `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
  <tr>
    <td style="padding: 8px 24px;">
      <table width="${p.width}" cellpadding="0" cellspacing="0" border="0" role="presentation">
        <tr>
          <td style="border-top: ${p.thickness}px ${p.style} ${p.color}; font-size: 1px; line-height: 1px;">&nbsp;</td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

    case "spacer":
      // Outlook needs line-height trick + nbsp for spacers
      return `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
  <tr>
    <td style="height: ${p.height}px; font-size: ${p.height}px; line-height: ${p.height}px; mso-line-height-rule: exactly;">&nbsp;</td>
  </tr>
</table>`;

    case "columns": {
      const leftPct = p.ratio === "30-70" ? 30 : p.ratio === "70-30" ? 70 : 50;
      const rightPct = 100 - leftPct;
      const leftPx = Math.round((552 * leftPct) / 100);
      const rightPx = 552 - leftPx;
      const wrapColumnContent = (text: string, image?: string) => {
        const imgHtml = image
          ? `<img src="${image}" alt="" width="${leftPx - 16}" style="max-width: 100%; height: auto; display: block; border: 0; border-radius: 8px; margin-bottom: 12px;" />`
          : "";
        const textHtml = String(text)
          .split("\n")
          .map(
            (line: string) =>
              `<p style="margin: 0 0 8px 0; color: #E7E5E4; font-size: 15px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${line || "&nbsp;"}</p>`,
          )
          .join("\n            ");
        return imgHtml + textHtml;
      };
      // font-size: 0 on the parent <td> collapses the whitespace between the
      // two inline-block columns — otherwise leftPct + rightPct = 100% plus a
      // ~4px text node from the newline between divs pushes the second column
      // to the next line. Each inner div resets font-size for its own text.
      return `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
  <tr>
    <td style="padding: 8px 24px; font-size: 0; line-height: 0;">
      <!--[if mso]><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="${leftPx}" valign="top"><![endif]-->
      <div style="display: inline-block; vertical-align: top; width: 100%; max-width: ${leftPct}%; font-size: 15px; line-height: 1.6;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="padding-right: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            ${wrapColumnContent(String(p.leftContent), String(p.leftImage || ""))}
          </td>
        </tr></table>
      </div><!--[if mso]></td><td width="${rightPx}" valign="top"><![endif]--><div style="display: inline-block; vertical-align: top; width: 100%; max-width: ${rightPct}%; font-size: 15px; line-height: 1.6;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="padding-left: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            ${wrapColumnContent(String(p.rightContent), String(p.rightImage || ""))}
          </td>
        </tr></table>
      </div>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>`;
    }

    case "social": {
      const socialLinks = (p.links as Array<{ platform: string; url: string }>)
        .map(
          (l) =>
            `<a href="${l.url}" style="display: inline-block; padding: 8px 16px; color: #D4836A; text-decoration: none; font-size: 13px; font-weight: 500; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${l.platform}</a>`,
        )
        .join(" ");
      return `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
  <tr>
    <td align="${p.align}" style="padding: 16px 24px;">
      ${socialLinks}
    </td>
  </tr>
</table>`;
    }

    case "html":
      return `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
  <tr>
    <td style="padding: 0 24px;">${normalizeFragment(String(p.code))}</td>
  </tr>
</table>`;

    default:
      return "";
  }
}

export function blocksToHtml(blocks: EmailBlock[], ctx: RenderContext): string {
  const inner = blocks.map((b) => blockToHtml(b, ctx)).join("\n");
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background-color: #2D2926; border-radius: 16px;">
  <tr>
    <td>
${inner}
    </td>
  </tr>
</table>`;
}

// Auto-heal helper: if a campaign's `blocks` JSON is present, regenerate the
// HTML from blocks so that fixes to blockToHtml propagate to existing
// campaigns without requiring a manual re-save. Falls back to the stored
// `html` field when blocks aren't available (e.g. legacy or imported-HTML
// campaigns).
export function renderCampaignHtml(
  fallbackHtml: string,
  blocksJson: string | null | undefined,
  ctx: RenderContext,
): string {
  if (!blocksJson) return fallbackHtml;
  try {
    const parsed = JSON.parse(blocksJson);
    if (!Array.isArray(parsed) || parsed.length === 0) return fallbackHtml;
    return blocksToHtml(
      parsed.map((b: { type: string; props: Record<string, unknown> }, i: number) => ({
        id: String(i),
        type: b.type as BlockType,
        props: b.props,
      })),
      ctx,
    );
  } catch {
    return fallbackHtml;
  }
}
