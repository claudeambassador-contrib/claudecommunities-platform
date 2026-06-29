/**
 * Parses email HTML into an array of EmailBlock objects for the visual builder.
 * Uses DOMParser to walk the structure and identify common email patterns:
 * - Large images → Image blocks
 * - Headings / large bold text → Header or Text blocks
 * - Button-styled links → Button blocks
 * - Spacer cells → Spacer blocks
 * - Horizontal rules → Divider blocks
 * - Text content → Text blocks
 */

interface EmailBlock {
  id: string;
  type:
    | "header"
    | "text"
    | "image"
    | "button"
    | "divider"
    | "spacer"
    | "columns"
    | "social"
    | "html";
  props: Record<string, unknown>;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function getComputedStyle(el: Element, prop: string): string {
  return (el as HTMLElement).style?.getPropertyValue(prop) || "";
}

function getAttr(el: Element, attr: string): string {
  return el.getAttribute(attr) || "";
}

function extractText(el: Element): string {
  // Get visible text, collapsing whitespace
  const text = (el.textContent || "")
    .replace(/(?:\s|\u00A0|\u200B|\u200C|\u200D|\uFEFF)+/gu, " ")
    .trim();
  return text;
}

function isSpacerCell(el: Element): number | false {
  const text = extractText(el);
  if (text && text !== "\u00A0" && text !== " ") return false;
  const height =
    parseInt(getAttr(el, "height"), 10) || parseInt(getComputedStyle(el, "height"), 10) || 0;
  if (height >= 4 && height <= 120) return height;
  // Check for spacer GIF images
  const img = el.querySelector("img");
  if (img) {
    const src = getAttr(img, "src").toLowerCase();
    if (src.includes("spacer") || src.includes("blank") || src.includes("transparent")) {
      const h = parseInt(getAttr(img, "height"), 10) || 0;
      if (h >= 4 && h <= 120) return h;
    }
  }
  return false;
}

function isButtonLink(
  el: Element,
): { text: string; url: string; bgColor: string; textColor: string } | false {
  if (el.tagName !== "A" && el.tagName !== "TD") return false;

  const a = el.tagName === "A" ? el : el.querySelector("a");
  if (!a) return false;

  const text = extractText(a);
  if (!text || text.length > 60) return false;

  const td = el.tagName === "TD" ? el : a.closest("td");
  const bgColor =
    getComputedStyle(td || a, "background-color") || getAttr(td || a, "bgcolor") || "";
  const textColor = getComputedStyle(a, "color") || "";

  // Check if it looks like a button: has background color, short text, uppercase or bold
  const style = (a as HTMLElement).style?.cssText || "";
  const tdStyle = (td as HTMLElement)?.style?.cssText || "";
  const isButton =
    (bgColor && bgColor !== "transparent" && bgColor !== "") ||
    style.includes("background") ||
    tdStyle.includes("background") ||
    (text.length < 40 &&
      (style.includes("text-transform") ||
        style.includes("font-weight: bold") ||
        style.includes("font-weight:bold")));

  if (!isButton) return false;

  return {
    text,
    url: getAttr(a, "href") || "#",
    bgColor: bgColor || "#D4836A",
    textColor: textColor || "#ffffff",
  };
}

function isHiddenElement(el: Element): boolean {
  const style = (el as HTMLElement).style?.cssText || "";
  if (
    style.includes("display: none") ||
    style.includes("display:none") ||
    style.includes("max-height: 0") ||
    style.includes("max-height:0")
  )
    return true;
  return Boolean(el.classList?.contains("preheader"));
}

function detectImage(el: Element): EmailBlock | null {
  if (el.tagName !== "IMG") return null;
  const src = getAttr(el, "src");
  const width = parseInt(getAttr(el, "width"), 10) || 0;
  const height = parseInt(getAttr(el, "height"), 10) || 0;
  // Skip tiny images (spacers, tracking pixels)
  if (!(src && (width > 50 || height > 50 || (!width && !height)))) return null;
  if (src.toLowerCase().includes("spacer") || src.toLowerCase().includes("blank")) return null;
  return {
    id: uid(),
    type: "image",
    props: {
      src,
      alt: getAttr(el, "alt") || "",
      link: el.closest("a")?.getAttribute("href") || "",
      width: "100%",
      align: "center",
      borderRadius: 0,
    },
  };
}

function detectSpacer(el: Element): EmailBlock | null {
  const tag = el.tagName;
  if (tag !== "TD" && tag !== "TR") return null;
  const spacerH = isSpacerCell(el);
  if (spacerH === false) return null;
  return { id: uid(), type: "spacer", props: { height: spacerH } };
}

function detectButton(el: Element): EmailBlock | null {
  if (el.tagName !== "TD") return null;
  const btn = isButtonLink(el);
  if (!btn) return null;
  return {
    id: uid(),
    type: "button",
    props: {
      text: btn.text,
      url: btn.url,
      bgColor: btn.bgColor,
      textColor: btn.textColor,
      align: "center",
      borderRadius: 8,
      fullWidth: false,
    },
  };
}

function detectTextOrHeading(el: Element): EmailBlock | null {
  const tag = el.tagName;
  const isTextCandidate =
    ((tag === "TD" || tag === "A" || tag === "H1" || tag === "H2" || tag === "H3") &&
      el.children.length === 0) ||
    (tag === "TD" && el.querySelectorAll("br").length > 0 && !el.querySelector("table"));
  if (!isTextCandidate) return null;

  const text = extractText(el);
  const fontSize = parseInt(getComputedStyle(el, "font-size"), 10) || 0;
  const fontWeight = getComputedStyle(el, "font-weight");
  const color = getComputedStyle(el, "color") || "";

  if (text && fontSize >= 24 && (fontWeight === "bold" || fontWeight === "700")) {
    // Check if parent has a background (header section)
    const parentTd = el.closest("td[bgcolor], td[style*='background']");
    const bgColor = parentTd ? getAttr(parentTd, "bgcolor") || "" : "";

    if (bgColor && bgColor !== "#ffffff" && bgColor !== "#f2f2f2") {
      return {
        id: uid(),
        type: "header",
        props: {
          title: text.replace(/\s+/g, " "),
          subtitle: "",
          showLogo: false,
          bgGradient: bgColor,
        },
      };
    }
    return {
      id: uid(),
      type: "text",
      props: {
        content: text.replace(/\s+/g, " "),
        fontSize: Math.min(fontSize, 24),
        color: color || "#E7E5E4",
        align: getComputedStyle(el, "text-align") || "center",
      },
    };
  }

  // Regular text content
  if (text && text.length > 3 && fontSize > 0 && !el.querySelector("table")) {
    return {
      id: uid(),
      type: "text",
      props: {
        content: text.replace(/\s{2,}/g, " "),
        fontSize: Math.min(fontSize || 15, 20),
        color: color || "#E7E5E4",
        align: getComputedStyle(el, "text-align") || "left",
      },
    };
  }

  return null;
}

function detectDivider(el: Element): EmailBlock | null {
  if (el.tagName !== "HR") return null;
  return {
    id: uid(),
    type: "divider",
    props: { color: "rgba(255,255,255,0.06)", width: "100%", thickness: 1, style: "solid" },
  };
}

function processElement(el: Element, blocks: EmailBlock[], depth: number = 0): void {
  if (depth > 20) return; // Safety limit

  if (isHiddenElement(el)) return;

  const detected =
    detectImage(el) ||
    detectSpacer(el) ||
    detectButton(el) ||
    detectTextOrHeading(el) ||
    detectDivider(el);
  if (detected) {
    blocks.push(detected);
    return;
  }

  // Recurse into children
  const children = el.children;
  for (let i = 0; i < children.length; i++) {
    processElement(children[i], blocks, depth + 1);
  }
}

export function htmlToBlocks(html: string): EmailBlock[] {
  if (typeof window === "undefined") return []; // Server-side guard

  const parser = new DOMParser();

  // Extract body content if full document
  let content = html;
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) content = bodyMatch[1];

  const doc = parser.parseFromString(`<div id="root">${content}</div>`, "text/html");
  const root = doc.getElementById("root");
  if (!root) return [];

  const blocks: EmailBlock[] = [];
  processElement(root, blocks);

  // Deduplicate consecutive spacers
  const deduped: EmailBlock[] = [];
  for (const block of blocks) {
    const prev = deduped[deduped.length - 1];
    if (prev?.type === "spacer" && block.type === "spacer") {
      // Merge consecutive spacers
      prev.props.height = Math.min(
        (prev.props.height as number) + (block.props.height as number),
        80,
      );
    } else {
      deduped.push(block);
    }
  }

  // If parsing produced very few blocks, fall back to a single HTML block
  if (deduped.length < 3 && html.length > 500) {
    return [
      {
        id: uid(),
        type: "html",
        props: { code: html },
      },
    ];
  }

  return deduped;
}
