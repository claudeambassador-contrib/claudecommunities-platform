"use client";

import { GripHorizontal, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import SlidePreview from "./SlidePreview";
import {
  type CustomElement,
  type DraggableElementKey,
  type ElementPosition,
  LAYOUT_DEFAULT_POSITIONS,
  type SlideSpeaker,
  type SlideTemplate,
} from "./types";

/**
 * Drag key in the DOM. Either one of the four standard layout slots, or
 * `custom:<id>` for an extras element. The standard keys participate in the
 * flex→absolute freeze; custom keys go through their own update branch.
 */
type DragKey = DraggableElementKey | `custom:${string}`;

const ELEMENT_LABELS: Record<DraggableElementKey, string> = {
  header: "Header",
  eventDate: "Event Date",
  headshot: "Photo",
  name: "Name",
  subtitle: "Title · Company",
  talk: "Talk",
  social: "Social",
  logo: "Logo",
};

const DRAGGABLE_KEYS: DraggableElementKey[] = [
  "header",
  "eventDate",
  "headshot",
  "name",
  "subtitle",
  "talk",
  "social",
  "logo",
];

/** Standard keys whose visible content is text (resize = width only). */
const TEXT_KEYS = new Set<DraggableElementKey>([
  "header",
  "eventDate",
  "name",
  "subtitle",
  "talk",
  "social",
]);

function isCustomKey(k: DragKey): k is `custom:${string}` {
  return k.startsWith("custom:");
}

function customIdFromKey(k: `custom:${string}`): string {
  return k.slice("custom:".length);
}

function labelFor(key: DragKey, customs: CustomElement[]): string {
  if (isCustomKey(key)) {
    const el = customs.find((e) => e.id === customIdFromKey(key));
    if (!el) return "Custom";
    if (el.type === "text") {
      const t = el.text.trim();
      return t ? `Text: ${t.slice(0, 14)}` : "Text";
    }
    return "Image";
  }
  return ELEMENT_LABELS[key];
}

/**
 * Whether the given element is text (width-only resize) or image-like
 * (width + height resize). Drives which resize handles are offered.
 */
function isTextElement(key: DragKey, customs: CustomElement[]): boolean {
  if (isCustomKey(key)) {
    const el = customs.find((e) => e.id === customIdFromKey(key));
    return el?.type === "text";
  }
  return TEXT_KEYS.has(key as DraggableElementKey);
}

/** Resize handle directions. Elements grow from their top-left anchor. */
type ResizeDir = "e" | "s" | "se";

/**
 * Snap thresholds for the Canva-style alignment guides. `SHOW` is how close
 * the dragged edge has to be to a target before the red guideline appears;
 * `SNAP` is the (tighter) distance at which the drag actually locks to it.
 * Two thresholds avoid jumpy snaps with invisible guides.
 */
const GUIDE_SHOW_PX = 8;
const GUIDE_SNAP_PX = 4;

interface DragSnapshot {
  /** Original wrapper-local edges of the dragged element (before any drag). */
  orig: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    centerX: number;
    centerY: number;
  };
  /** Candidate x positions (wrapper-local) to align to. */
  xTargets: number[];
  /** Candidate y positions (wrapper-local) to align to. */
  yTargets: number[];
}

/** Selected element's box in wrapper-local screen px (for outline + handles). */
interface SelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * For each axis, find the best snap target (smallest distance under
 * SNAP threshold) and a list of guide-worthy hits (under SHOW threshold).
 * Returns the snap offset to apply and the absolute coordinates of any
 * guides to draw. Edges checked: left/center/right (x) and top/center/
 * bottom (y) of the dragged element.
 */
function computeSnap(
  origLeftEdge: number,
  origCenterEdge: number,
  origRightEdge: number,
  delta: number,
  targets: number[],
): { snapDelta: number; guides: number[] } {
  const draggedEdges = [origLeftEdge + delta, origCenterEdge + delta, origRightEdge + delta];
  let bestSnap: { offset: number; absDist: number } | null = null;
  const guides: number[] = [];

  for (const target of targets) {
    let minHere = Number.POSITIVE_INFINITY;
    let bestOffsetHere = 0;
    for (const edge of draggedEdges) {
      const dist = target - edge;
      const abs = Math.abs(dist);
      if (abs < minHere) {
        minHere = abs;
        bestOffsetHere = dist;
      }
    }
    if (minHere <= GUIDE_SHOW_PX) guides.push(target);
    if (minHere <= GUIDE_SNAP_PX) {
      if (!bestSnap || minHere < bestSnap.absDist) {
        bestSnap = { offset: bestOffsetHere, absDist: minHere };
      }
    }
  }
  return { snapDelta: bestSnap ? bestSnap.offset : 0, guides };
}

function buildDragSnapshot(
  wrapper: HTMLElement,
  draggedEl: HTMLElement,
  slideRect: DOMRect,
): DragSnapshot {
  const wRect = wrapper.getBoundingClientRect();
  const r = draggedEl.getBoundingClientRect();
  const orig = {
    left: r.left - wRect.left,
    top: r.top - wRect.top,
    right: r.right - wRect.left,
    bottom: r.bottom - wRect.top,
    centerX: r.left - wRect.left + r.width / 2,
    centerY: r.top - wRect.top + r.height / 2,
  };

  // Slide edges (in wrapper-local coords) — three per axis: near edge,
  // centre, far edge. These are the most useful snap targets in practice
  // so they get included even when the slide has only one element.
  const slideLeft = slideRect.left - wRect.left;
  const slideTop = slideRect.top - wRect.top;
  const xTargets: number[] = [
    slideLeft,
    slideLeft + slideRect.width / 2,
    slideLeft + slideRect.width,
  ];
  const yTargets: number[] = [
    slideTop,
    slideTop + slideRect.height / 2,
    slideTop + slideRect.height,
  ];

  // Every OTHER draggable element contributes its left/centerX/right and
  // top/centerY/bottom. We exclude the dragged element itself.
  const all = wrapper.querySelectorAll<HTMLElement>("[data-slide-el]");
  for (const el of Array.from(all)) {
    if (el === draggedEl) continue;
    const er = el.getBoundingClientRect();
    if (er.width === 0 && er.height === 0) continue;
    const elLeft = er.left - wRect.left;
    const elTop = er.top - wRect.top;
    xTargets.push(elLeft, elLeft + er.width / 2, elLeft + er.width);
    yTargets.push(elTop, elTop + er.height / 2, elTop + er.height);
  }

  return { orig, xTargets, yTargets };
}

/**
 * Freeze the current visual positions of all draggable elements into an
 * `elementPositions` map. Used when transitioning from the flex-based layout
 * into absolute positioning on first drag/resize, so that *only* the element
 * the user is interacting with appears to move.
 *
 * If a freshly-loaded layout still has no custom positions, dragging element X
 * would previously have pinned X to defaults+delta while leaving the others
 * unset — so on next render the other elements jumped from their flex
 * positions to the (different) defaults. Measuring them all upfront eliminates
 * that jump and is the actual fix for the misalignment bug.
 *
 * Only the headshot captures a `width`/`height` footprint — text elements get
 * `x`/`y` only, so a freeze never silently turns text into a fixed-width
 * wrapping box (that's opt-in via the resize handle, which sets `wrap`).
 */
function freezeCurrentPositions(
  wrapper: HTMLElement,
  slideRect: DOMRect,
  template: SlideTemplate,
): Record<DraggableElementKey, ElementPosition> {
  const existing = template.layout_config.elementPositions;
  const defaults =
    LAYOUT_DEFAULT_POSITIONS[template.layout] ?? LAYOUT_DEFAULT_POSITIONS["bottom-left"];
  const out: Record<DraggableElementKey, ElementPosition> = {
    header: defaults.header,
    eventDate: defaults.eventDate,
    headshot: defaults.headshot,
    name: defaults.name,
    subtitle: defaults.subtitle,
    talk: defaults.talk,
    social: defaults.social,
    logo: defaults.logo,
  };
  for (const key of DRAGGABLE_KEYS) {
    if (existing?.[key]) {
      // Already absolute — keep what's there (preserves explicit resizes).
      out[key] = existing[key];
      continue;
    }
    const el = wrapper.querySelector(`[data-slide-el="${key}"]`) as HTMLElement | null;
    if (!el) {
      // Element not rendered (visibility off etc.) — fall back to the default.
      continue;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const x = ((r.left - slideRect.left) / slideRect.width) * 100;
    const y = ((r.top - slideRect.top) / slideRect.height) * 100;
    if (key === "headshot") {
      const width = (r.width / slideRect.width) * 100;
      const height = (r.height / slideRect.height) * 100;
      out[key] = { x, y, width, height };
    } else {
      out[key] = { x, y };
    }
  }
  return out;
}

interface Props {
  template: SlideTemplate;
  speaker: SlideSpeaker | null;
  onChange: (patch: Partial<SlideTemplate>) => void;
  /** Editor zoom (1 = 100%). The slide content is scaled by this; the wrapper
   *  stays unscaled so overlays/handles are positioned in screen px. */
  zoom: number;
  /** Unscaled slide width in px — drives the scaled inner content width. */
  baseWidth: number;
  /** Fires whenever the selection changes (data-slide-el key, or null). */
  onSelect?: (key: string | null) => void;
}

export default function DraggableSlideEditor({
  template,
  speaker,
  onChange,
  zoom,
  baseWidth,
  onSelect,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const templateRef = useRef(template);
  const onChangeRef = useRef(onChange);
  const zoomRef = useRef(zoom);
  const onSelectRef = useRef(onSelect);
  templateRef.current = template;
  onChangeRef.current = onChange;
  zoomRef.current = zoom;
  onSelectRef.current = onSelect;

  const [activeEl, setActiveEl] = useState<DragKey | null>(null);
  const [selectedEl, setSelectedEl] = useState<DragKey | null>(null);
  const [selRect, setSelRect] = useState<SelRect | null>(null);
  const [resizing, setResizing] = useState(false);
  /** Active alignment guidelines (wrapper-local px). Cleared on mouseup. */
  const [guides, setGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });

  const dragRef = useRef<{
    key: DragKey;
    el: HTMLElement;
    startX: number;
    startY: number;
    origTransform: string;
    /** Snap-adjusted deltas (screen px), kept up to date on mousemove.
     *  Mouseup reads these so the persisted position matches the screen. */
    snappedDx: number;
    snappedDy: number;
    /** Raw deltas — used to detect "this was actually a drag, not a click"
     *  so click-jitter near an alignment edge doesn't get amplified into a
     *  ~4px snap shift on every click. */
    rawDx: number;
    rawDy: number;
    snapshot: DragSnapshot | null;
  } | null>(null);

  const resizeRef = useRef<{
    key: DragKey;
    el: HTMLElement;
    dir: ResizeDir;
    startX: number;
    startY: number;
    /** Element box at gesture start, in screen px (post-zoom). */
    startW: number;
    startH: number;
    /** Slide box in screen px (post-zoom) for %-conversion. */
    slideW: number;
    slideH: number;
    isText: boolean;
    /** Element aspect (startW/startH) for Ctrl/Alt ratio-lock on images. */
    aspect: number;
    /** Inline styles to restore before committing (mirrors the drag path). */
    orig: { width: string; height: string; whiteSpace: string; maxWidth: string };
    /** Latest on-screen size (px) the element was set to; commit reads these. */
    lastVisW: number;
    lastVisH: number;
  } | null>(null);

  const getSlideRect = useCallback((): DOMRect | null => {
    const w = wrapperRef.current;
    if (!w) return null;
    const slide = w.querySelector('[style*="aspect-ratio"]') as HTMLElement | null;
    return slide?.getBoundingClientRect() ?? null;
  }, []);

  // Measure the selected element's box in wrapper-local screen px. The wrapper
  // is unscaled, so these coordinates are written straight back as CSS left/
  // top/width/height with no zoom division.
  const updateSelRect = useCallback((key: DragKey) => {
    const w = wrapperRef.current;
    if (!w) return;
    const el = w.querySelector(`[data-slide-el="${key}"]`) as HTMLElement | null;
    if (!el) {
      setSelRect(null);
      return;
    }
    const wRect = w.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    setSelRect({
      left: elRect.left - wRect.left,
      top: elRect.top - wRect.top,
      width: elRect.width,
      height: elRect.height,
    });
  }, []);

  const selectKey = useCallback(
    (key: DragKey | null) => {
      setSelectedEl(key);
      onSelectRef.current?.(key);
      if (key) updateSelRect(key);
      else setSelRect(null);
    },
    [updateSelRect],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const target = (e.target as HTMLElement).closest("[data-slide-el]") as HTMLElement | null;
      if (!target) {
        selectKey(null);
        return;
      }
      const key = target.getAttribute("data-slide-el") as DragKey;
      e.preventDefault();
      setActiveEl(key);
      selectKey(key);
      const slideRect = getSlideRect();
      const wrapper = wrapperRef.current;
      const snapshot = wrapper && slideRect ? buildDragSnapshot(wrapper, target, slideRect) : null;
      dragRef.current = {
        key,
        el: target,
        startX: e.clientX,
        startY: e.clientY,
        origTransform: target.style.transform || "",
        snappedDx: 0,
        snappedDy: 0,
        rawDx: 0,
        rawDy: 0,
        snapshot,
      };
    },
    [getSlideRect, selectKey],
  );

  // Element drag.
  useEffect(() => {
    if (!activeEl || !dragRef.current) return;
    const d = dragRef.current;

    const onMove = (e: MouseEvent) => {
      const rawDx = e.clientX - d.startX;
      const rawDy = e.clientY - d.startY;
      d.rawDx = rawDx;
      d.rawDy = rawDy;

      // Hold Alt or Shift to bypass alignment snapping. Useful when the
      // designer wants a pixel-precise placement that happens to be near
      // another element's edge.
      const bypass = e.altKey || e.shiftKey;
      // Don't snap until the user has clearly moved — otherwise click-jitter
      // within ~SNAP px of an alignment edge will yank the element by the
      // snap delta and the mouseup gate below will persist that yank.
      const intentToDrag = Math.abs(rawDx) > 3 || Math.abs(rawDy) > 3;
      let dx = rawDx;
      let dy = rawDy;
      let activeGuides: { x: number[]; y: number[] } = { x: [], y: [] };
      const snap = d.snapshot;
      if (snap && !bypass && intentToDrag) {
        const xResult = computeSnap(
          snap.orig.left,
          snap.orig.centerX,
          snap.orig.right,
          rawDx,
          snap.xTargets,
        );
        const yResult = computeSnap(
          snap.orig.top,
          snap.orig.centerY,
          snap.orig.bottom,
          rawDy,
          snap.yTargets,
        );
        dx = rawDx + xResult.snapDelta;
        dy = rawDy + yResult.snapDelta;
        activeGuides = { x: xResult.guides, y: yResult.guides };
      }

      d.snappedDx = dx;
      d.snappedDy = dy;
      // The element lives inside the zoom-scaled content, so a translate in its
      // local space renders at delta×zoom on screen. Divide by zoom so it
      // tracks the cursor. The persisted % below uses the screen delta over the
      // (already scaled) slide width, so it stays correct independent of zoom.
      const z = zoomRef.current || 1;
      const tx = dx / z;
      const ty = dy / z;
      d.el.style.transform = d.origTransform
        ? `translate(${tx}px, ${ty}px) ${d.origTransform}`
        : `translate(${tx}px, ${ty}px)`;
      setGuides(activeGuides);
    };

    const onUp = () => {
      const slideRect = getSlideRect();
      const wrapper = wrapperRef.current;
      // Gate "moved" on the RAW pointer delta — a click that wiggled <2px
      // shouldn't persist a snap-amplified shift. Once raw movement clears
      // the threshold, persist the snap-adjusted delta so the saved
      // position matches what was on screen.
      const movedRaw = Math.abs(d.rawDx) > 2 || Math.abs(d.rawDy) > 2;
      const dx = d.snappedDx;
      const dy = d.snappedDy;

      const moved = wrapper && slideRect && slideRect.width > 0 && movedRaw;

      if (moved) {
        // Critical: clear the visual translate BEFORE measuring, otherwise
        // getBoundingClientRect returns the already-moved position and we'd
        // double-count the delta.
        d.el.style.transform = d.origTransform;

        const pctDx = (dx / slideRect.width) * 100;
        const pctDy = (dy / slideRect.height) * 100;
        const t = templateRef.current;

        if (isCustomKey(d.key)) {
          // Custom (extras) element — update its position directly.
          const id = customIdFromKey(d.key);
          const customs = (t.custom_elements ?? []).map((el) => {
            if (el.id !== id) return el;
            const p = el.position;
            return {
              ...el,
              position: { ...p, x: p.x + pctDx, y: p.y + pctDy },
            };
          });
          onChangeRef.current({ custom_elements: customs });
        } else {
          // Standard key — freeze every standard element's current visual
          // position before mutating one (flex→absolute jump fix).
          const positions = freezeCurrentPositions(wrapper, slideRect, t);
          const cur = positions[d.key];
          positions[d.key] = { ...cur, x: cur.x + pctDx, y: cur.y + pctDy };
          onChangeRef.current({
            layout_config: { ...t.layout_config, elementPositions: positions },
          });
        }
      } else {
        d.el.style.transform = d.origTransform;
      }

      setActiveEl(null);
      setGuides({ x: [], y: [] });
      dragRef.current = null;
      requestAnimationFrame(() => updateSelRect(d.key));
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [activeEl, getSlideRect, updateSelRect]);

  // Begin a resize gesture from one of the handles. Stops propagation so the
  // element-drag in handleMouseDown doesn't also fire.
  const startResize = useCallback(
    (dir: ResizeDir) => (e: React.MouseEvent) => {
      if (!selectedEl) return;
      e.preventDefault();
      e.stopPropagation();
      const wrapper = wrapperRef.current;
      const slideRect = getSlideRect();
      if (!wrapper || !slideRect) return;
      const el = wrapper.querySelector(`[data-slide-el="${selectedEl}"]`) as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const customs = templateRef.current.custom_elements ?? [];
      resizeRef.current = {
        key: selectedEl,
        el,
        dir,
        startX: e.clientX,
        startY: e.clientY,
        startW: r.width,
        startH: r.height,
        slideW: slideRect.width,
        slideH: slideRect.height,
        isText: isTextElement(selectedEl, customs),
        aspect: r.height > 0 ? r.width / r.height : 1,
        orig: {
          width: el.style.width,
          height: el.style.height,
          whiteSpace: el.style.whiteSpace,
          maxWidth: el.style.maxWidth,
        },
        lastVisW: r.width,
        lastVisH: r.height,
      };
      setResizing(true);
    },
    [selectedEl, getSlideRect],
  );

  // Resize gesture (live DOM preview + commit on mouseup).
  useEffect(() => {
    if (!resizing || !resizeRef.current) return;
    const r = resizeRef.current;
    const MIN_PX = 14; // minimum on-screen size while dragging a handle

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: resize-drag math — branches over aspect-lock, text vs image, and each edge/corner handle; splitting it would scatter the single pointer-move gesture
    const onMove = (e: MouseEvent) => {
      const z = zoomRef.current || 1;
      const dx = e.clientX - r.startX;
      const dy = e.clientY - r.startY;
      // Ctrl or Alt locks the aspect ratio (image-like elements only — text has
      // no fixed height, so a forced height would just clip it).
      const lockAspect = !r.isText && (e.ctrlKey || e.altKey);
      const horiz = r.dir === "e" || r.dir === "se";
      const vert = r.dir === "s" || r.dir === "se";

      let visW = horiz ? Math.max(MIN_PX, r.startW + dx) : r.startW;
      let visH = vert ? Math.max(MIN_PX, r.startH + dy) : r.startH;
      if (lockAspect) {
        // Derive the locked dimension from whichever axis the pointer drives.
        if (r.dir === "se") {
          if (Math.abs(dx) >= Math.abs(dy)) visH = visW / r.aspect;
          else visW = visH * r.aspect;
        } else if (r.dir === "e") {
          visH = visW / r.aspect;
        } else {
          visW = visH * r.aspect;
        }
        visW = Math.max(MIN_PX, visW);
        visH = Math.max(MIN_PX, visH);
      }
      r.lastVisW = visW;
      r.lastVisH = visH;

      // Element sizes are in local (pre-zoom) px, so divide by zoom to land at
      // the intended on-screen size. Text only ever changes width.
      if (horiz || lockAspect) r.el.style.width = `${visW / z}px`;
      if (!r.isText && (vert || lockAspect)) r.el.style.height = `${visH / z}px`;
      if (r.isText) {
        r.el.style.whiteSpace = "normal";
        r.el.style.maxWidth = "none";
      }

      // Keep the selection outline / handles tracking the live size.
      const w = wrapperRef.current;
      if (w) {
        const wRect = w.getBoundingClientRect();
        const er = r.el.getBoundingClientRect();
        setSelRect({
          left: er.left - wRect.left,
          top: er.top - wRect.top,
          width: er.width,
          height: er.height,
        });
      }
    };

    const onUp = () => {
      // Restore the inline styles we mutated, then commit via onChange so React
      // owns the final style (avoids stale imperative styles lingering).
      r.el.style.width = r.orig.width;
      r.el.style.height = r.orig.height;
      r.el.style.whiteSpace = r.orig.whiteSpace;
      r.el.style.maxWidth = r.orig.maxWidth;

      // Commit the live on-screen size as slide-%. Text commits width only
      // (+ wrap); image-like elements commit both axes so an edge-only resize
      // preserves the untouched dimension instead of snapping to a default.
      const widthPct = Math.max(3, Math.min(100, (r.lastVisW / r.slideW) * 100));
      const heightPct = Math.max(3, Math.min(100, (r.lastVisH / r.slideH) * 100));

      const t = templateRef.current;
      const wrapper = wrapperRef.current;
      const slideRect = getSlideRect();

      if (isCustomKey(r.key)) {
        const id = customIdFromKey(r.key);
        const customs = (t.custom_elements ?? []).map((el) => {
          if (el.id !== id) return el;
          const p = { ...el.position, width: widthPct };
          if (el.type === "image") p.height = heightPct;
          return { ...el, position: p };
        });
        onChangeRef.current({ custom_elements: customs });
      } else if (wrapper && slideRect) {
        const positions = freezeCurrentPositions(wrapper, slideRect, t);
        const cur = positions[r.key];
        const next: ElementPosition = { ...cur, width: widthPct };
        if (r.isText) next.wrap = true;
        else next.height = heightPct;
        positions[r.key] = next;
        onChangeRef.current({
          layout_config: { ...t.layout_config, elementPositions: positions },
        });
      }

      const key = r.key;
      resizeRef.current = null;
      setResizing(false);
      requestAnimationFrame(() => updateSelRect(key));
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizing, getSlideRect, updateSelRect]);

  // Re-measure the selection box when the selection, content, or zoom changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: template/speaker/zoom/baseWidth are intentional re-run triggers — when the slide content or scale re-renders the selected element moves, so the selection box must be re-measured
  useEffect(() => {
    if (selectedEl) updateSelRect(selectedEl);
  }, [selectedEl, updateSelRect, template, speaker, zoom, baseWidth]);

  const resetPositions = useCallback(() => {
    const t = templateRef.current;
    const next = { ...t.layout_config, elementPositions: undefined };
    onChangeRef.current({ layout_config: next });
    selectKey(null);
  }, [selectKey]);

  const customs = template.custom_elements ?? [];

  // eventDate is a short single-line date — selectable/draggable but not
  // resizable. Text elements resize width-only; image-like get width + height.
  const handleDirs: ResizeDir[] =
    !selectedEl || selectedEl === "eventDate"
      ? []
      : isTextElement(selectedEl, customs)
        ? ["e"]
        : ["e", "s", "se"];

  return (
    <div ref={wrapperRef} className="relative w-full h-full" style={{ userSelect: "none" }}>
      <style>{`
        .drag-slide-editor [data-slide-el] {
          cursor: grab;
        }
        .drag-slide-editor [data-slide-el]:hover {
          outline: 1px dashed rgba(212, 131, 106, 0.5);
          outline-offset: 4px;
        }
      `}</style>

      {/* Zoom-scaled slide content. The wrapper above stays unscaled so the
          overlays/handles below are positioned directly in screen px. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: pointer-only drag/pan canvas for direct manipulation of slide elements — not a discrete control, so role/keyboard semantics don't apply */}
      <div
        className="drag-slide-editor"
        style={{
          width: baseWidth > 0 ? `${baseWidth}px` : "100%",
          transform: `scale(${zoom})`,
          transformOrigin: "top left",
        }}
        onMouseDown={handleMouseDown}
      >
        <SlidePreview template={template} speaker={speaker} />
      </div>

      {/* Grid guides */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/[0.08]" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-white/[0.08]" />
        <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/[0.05]" />
        <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/[0.05]" />
        <div className="absolute top-1/3 left-0 right-0 h-px bg-white/[0.05]" />
        <div className="absolute top-2/3 left-0 right-0 h-px bg-white/[0.05]" />
      </div>

      {/* Alignment guidelines (Canva-style) — only shown while dragging. */}
      {(guides.x.length > 0 || guides.y.length > 0) && (
        <div className="absolute inset-0 pointer-events-none z-40">
          {guides.x.map((x) => (
            <div
              key={`gx-${x}`}
              className="absolute top-0 bottom-0 bg-[#ff3b30]"
              style={{ left: x, width: 1, boxShadow: "0 0 2px rgba(255,59,48,0.6)" }}
            />
          ))}
          {guides.y.map((y) => (
            <div
              key={`gy-${y}`}
              className="absolute left-0 right-0 bg-[#ff3b30]"
              style={{ top: y, height: 1, boxShadow: "0 0 2px rgba(255,59,48,0.6)" }}
            />
          ))}
        </div>
      )}

      {/* Selection outline + resize handles + label chip (screen-space).
          Hidden mid-drag (selRect only refreshes on drop) so the handles don't
          detach and fly off while the element is being moved. */}
      {selectedEl && selRect && !activeEl && (
        <>
          <div
            className="absolute z-30 pointer-events-none border border-[#D4836A]"
            style={{
              left: selRect.left,
              top: selRect.top,
              width: selRect.width,
              height: selRect.height,
            }}
          />
          <div
            className="absolute z-50 flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#D4836A] text-white shadow-sm pointer-events-none"
            style={{ left: selRect.left, top: Math.max(0, selRect.top - 20) }}
          >
            <GripHorizontal className="w-2.5 h-2.5" />
            <span className="text-[9px] font-medium">{labelFor(selectedEl, customs)}</span>
          </div>
          {handleDirs.map((dir) => {
            const handleLeft =
              dir === "e"
                ? selRect.left + selRect.width - 5
                : dir === "s"
                  ? selRect.left + selRect.width / 2 - 5
                  : selRect.left + selRect.width - 5;
            const handleTop =
              dir === "e"
                ? selRect.top + selRect.height / 2 - 5
                : dir === "s"
                  ? selRect.top + selRect.height - 5
                  : selRect.top + selRect.height - 5;
            const cursor = dir === "e" ? "ew-resize" : dir === "s" ? "ns-resize" : "nwse-resize";
            return (
              <button
                key={dir}
                type="button"
                aria-label={`Resize ${dir}`}
                onMouseDown={startResize(dir)}
                className="absolute z-50 w-2.5 h-2.5 rounded-[2px] bg-white border border-[#D4836A] shadow"
                style={{ left: handleLeft, top: handleTop, cursor }}
              />
            );
          })}
        </>
      )}

      <div className="absolute top-2 right-2 z-50">
        <button
          type="button"
          onClick={resetPositions}
          className="h-7 px-2 bg-black/60 hover:bg-black/80 text-white/70 hover:text-white text-[10px] gap-1 backdrop-blur-sm rounded inline-flex items-center"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
      </div>

      <div className="absolute bottom-2 left-2 z-50 px-2 py-1 rounded bg-[#D4836A]/80 backdrop-blur-sm text-[10px] text-white font-medium pointer-events-none">
        Drag to move (Alt/Shift = no snap) · Drag a handle to resize (Ctrl/Alt = lock ratio)
      </div>
    </div>
  );
}
