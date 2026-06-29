/**
 * Signed render-only slide page consumed by Cloudflare Browser Rendering
 * (puppeteer.connect → headless Chromium screenshot). Reached over the public
 * internet with no Clerk session — the HMAC signature on the query string is
 * the only credential. Returns 404 for missing/invalid signatures, missing
 * slides, or missing speakers; puppeteer treats those as failed renders.
 *
 * The page renders inside the app's root layout (so Tailwind utility classes
 * used by `<SlidePreview>` work) but `ConditionalLayout` skips chrome for
 * `/internal/*`. The puppeteer caller waits for `body[data-slide-ready=1]`
 * before screenshotting the `#slide-root` div.
 */
import { notFound } from "next/navigation";
import { FONT_OPTIONS } from "@/components/slide-generator/fonts";
import type { SlideEntry } from "@/components/slide-generator/persistence";
import SlidePreview from "@/components/slide-generator/SlidePreview";
import {
  ASPECT_RATIOS,
  type SlideSpeaker,
  type SlideTemplate,
} from "@/components/slide-generator/types";
import { getStateInternal } from "@/lib/services/slideGenerator";
import { getSpeakerInternal } from "@/lib/services/speakers";
import { verifySlideRenderSig } from "@/lib/slideRenderSign";
import { getTenantConfig } from "@/lib/tenant-config";
import { runWithTenant } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ eventId: string; slideId: string; speakerId: string }>;
  searchParams: Promise<{ sig?: string; exp?: string; w?: string; t?: string }>;
}

interface StoredStateLike {
  slides?: SlideEntry[];
  template?: SlideTemplate; // legacy v1
}

function pickTemplate(data: unknown, slideId: string): SlideTemplate | null {
  if (!data || typeof data !== "object") return null;
  const state = data as StoredStateLike;
  if (Array.isArray(state.slides)) {
    return state.slides.find((s) => s.id === slideId)?.template ?? null;
  }
  return state.template ?? null;
}

function speakerForSlide(s: {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  talkTitle: string | null;
  talkDescription: string | null;
  talkDescriptionShort: string | null;
  headshotUrl: string | null;
  companyLogoUrl: string | null;
  twitterHandle: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
}): SlideSpeaker {
  return {
    id: s.id,
    name: s.name,
    title: s.title,
    company: s.company,
    talk_title: s.talkTitle,
    talk_description: s.talkDescription,
    talk_description_short: s.talkDescriptionShort,
    headshot_url: s.headshotUrl,
    company_logo_url: s.companyLogoUrl,
    twitter_handle: s.twitterHandle,
    linkedin_url: s.linkedinUrl,
    website_url: s.websiteUrl,
  };
}

function absolutize(url: string | null | undefined, origin: string): string | null {
  if (!url) return null;
  if (url.startsWith("/")) return `${origin}${url}`;
  return url;
}

function withAbsoluteUrls(template: SlideTemplate, speaker: SlideSpeaker, origin: string) {
  const t: SlideTemplate = {
    ...template,
    background_image_url: absolutize(template.background_image_url, origin),
    custom_elements: template.custom_elements.map((el) =>
      el.type === "image" ? { ...el, url: absolutize(el.url, origin) ?? "" } : el,
    ),
  };
  const s: SlideSpeaker = {
    ...speaker,
    headshot_url: absolutize(speaker.headshot_url, origin),
    company_logo_url: absolutize(speaker.company_logo_url, origin),
  };
  return { template: t, speaker: s };
}

export default async function SlideRenderPage({ params, searchParams }: PageProps) {
  const { eventId, slideId, speakerId } = await params;
  const { sig, exp, w, t } = await searchParams;
  const expNum = Number(exp);
  const refWidth = Number(w);

  if (!sig || !t || !Number.isFinite(expNum) || !Number.isFinite(refWidth) || refWidth <= 0) {
    notFound();
  }
  // `t` is the slide's tenant, bound into the signed payload — a tampered tenant
  // fails verification, so the signature can't be replayed across tenants.
  const ok = await verifySlideRenderSig({
    tenant: t,
    eventId,
    slideId,
    speakerId,
    refWidth,
    exp: expNum,
    sig,
  });
  if (!ok) notFound();

  // Re-establish the bound tenant's scope for the scoped data reads + origin —
  // this page is selfTenanted (no middleware header), so without runWithTenant
  // getStateInternal/getSpeakerInternal/getTenantConfig would fail-closed throw.
  const { state, speakerRow, origin } = await runWithTenant(t, async () => {
    const [state, speakerRow] = await Promise.all([
      getStateInternal(`event:${eventId}`),
      getSpeakerInternal(speakerId),
    ]);
    if (!state || !speakerRow) notFound();
    if (speakerRow.eventId !== eventId) notFound();
    return { state, speakerRow, origin: (await getTenantConfig()).appUrl };
  });

  const rawTemplate = pickTemplate(state.data, slideId);
  if (!rawTemplate) notFound();

  // Surface the visual fingerprint into the worker log so we can correlate
  // "looks wrong in the PNG" with what the renderer actually had to work
  // with — covers font sizes, layout, headshot, and any frozen positions.
  console.warn(
    `[slide-render-page] eventId=${eventId} slideId=${slideId} speakerId=${speakerId} ` +
      `template=${JSON.stringify({
        aspect: rawTemplate.aspect_ratio,
        layout: rawTemplate.layout,
        header: { size: rawTemplate.header_font_size, font: rawTemplate.header_font },
        name: { size: rawTemplate.name_font_size, font: rawTemplate.name_font },
        headshot: { size: rawTemplate.headshot_size, shape: rawTemplate.headshot_shape },
        elementPositions: rawTemplate.layout_config?.elementPositions ?? null,
        contentOffset: {
          x: rawTemplate.layout_config?.contentOffsetX,
          y: rawTemplate.layout_config?.contentOffsetY,
        },
      })} speaker=${JSON.stringify({
        name: speakerRow.name,
        headshotUrl: speakerRow.headshotUrl,
      })}`,
  );

  const { template, speaker } = withAbsoluteUrls(rawTemplate, speakerForSlide(speakerRow), origin);
  const config = ASPECT_RATIOS[template.aspect_ratio] ?? ASPECT_RATIOS["16:9"];
  // Render the slide-root at the caller-requested reference width (CSS px).
  // Puppeteer's deviceScaleFactor upscales the screenshot to `config.width`
  // for the final PNG. This keeps text proportions in the PNG identical to
  // what the editor preview shows at the same pane width.
  const slideWidthCss = refWidth;
  const slideHeightCss = Math.round((refWidth * config.height) / config.width);

  // Mirror what the standalone editor's `loadAllFonts()` does, but inline at
  // SSR time so the puppeteer page has the fonts available before the
  // readiness signal fires. Without this the headless browser falls back to
  // Georgia/system-serif, which has different metrics than the user-chosen
  // family (Playfair Display, Fraunces, etc.) and shifts the rendered slide
  // visibly away from the editor preview.
  const fontsHref = `https://fonts.googleapis.com/css2?family=${FONT_OPTIONS.map(
    (f) => `${f.family.replace(/ /g, "+")}:wght@400;500;600;700;800`,
  ).join("&family=")}&display=swap`;

  // Inline readiness script: runs as soon as the browser parses it (no
  // React hydration involved). Required because the puppeteer caller waits
  // for `body[data-slide-ready="1"]`, and the root layout's Clerk/Providers
  // can delay hydration past our 30s render timeout.
  //
  // The script counts down every <img> in the document AND waits for
  // `document.fonts.ready` so the screenshot reflects the chosen typefaces
  // (not the system fallback). An 8s ceiling guarantees forward progress if
  // any image or font hangs.
  const readyScript = `(function(){
    var marked=false;
    function mark(reason){if(marked)return;marked=true;console.log('[ready]',reason);document.body.setAttribute('data-slide-ready','1');}
    function snapshotImgs(){
      var list=Array.prototype.slice.call(document.images||[]);
      console.log('[imgs] count='+list.length);
      list.forEach(function(img,i){
        console.log('[imgs] '+i+' complete='+img.complete+' natural='+img.naturalWidth+'x'+img.naturalHeight+' src='+img.src);
      });
      return list;
    }
    // Re-collect images after a frame so any element rendered post-hydration
    // is observed by the readiness gate too.
    requestAnimationFrame(function(){
      var imgs=snapshotImgs();
      var fontsReady=document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve();
      var imgsReady=imgs.length===0?Promise.resolve():new Promise(function(resolve){
        var n=imgs.length;
        function done(img,reason){
          console.log('[img-'+reason+']',img&&img.src,'natural='+(img&&img.naturalWidth)+'x'+(img&&img.naturalHeight));
          if(--n<=0)resolve();
        }
        imgs.forEach(function(img){
          if(img.complete){done(img,'already');return;}
          img.addEventListener('load',function(){done(img,'load');},{once:true});
          img.addEventListener('error',function(){done(img,'error');},{once:true});
        });
      });
      Promise.all([fontsReady,imgsReady]).then(function(){mark('imgs+fonts');},function(){mark('imgs+fonts-rejected');});
    });
    setTimeout(function(){mark('timeout');},8000);
  })();`;

  return (
    <>
      <link rel="stylesheet" href={fontsHref} />
      <div
        id="slide-root"
        style={{
          width: `${slideWidthCss}px`,
          height: `${slideHeightCss}px`,
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        <SlidePreview template={template} speaker={speaker} />
      </div>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: signal script, no user input */}
      <script dangerouslySetInnerHTML={{ __html: readyScript }} />
    </>
  );
}
