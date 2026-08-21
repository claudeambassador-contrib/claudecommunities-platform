import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import type {
  Block,
  CtaBlock,
  GalleryBlock,
  HeroBlock,
  RichTextBlock,
  WebinarBlock,
} from "@/modules/pages/types";
import { HomeSectionsEditor } from "@/modules/pages/ui/home-sections-editor";
import type { SaveHomeResult } from "@/modules/pages/ui/home-sections-editor";
import type { Permission } from "@/shared/auth/permissions";
import { PermissionsProvider } from "@/shared/ui/can";

const BADGE_RE = /Badge/;
const BLK_ID_RE = /^blk_/;
const BODY_RE = /Body/;
const CTA_LABEL_SIGNED_OUT_RE = /CTA label \(signed out\)/;
const HEADING_RE = /Heading/;
const PRIMARY_CTA_LABEL_RE = /Primary CTA label/;
const SUBHEADING_RE = /Subheading/;
const THUMBNAIL_URL_RE = /Thumbnail URL/;

function hero(overrides: Partial<HeroBlock> = {}): HeroBlock {
  return {
    badge: "New",
    body: "Welcome",
    enabled: true,
    heading: "Hero heading",
    id: "blk_hero",
    primaryCtaLabel: "Join",
    type: "hero",
    ...overrides,
  };
}

function richText(overrides: Partial<RichTextBlock> = {}): RichTextBlock {
  return {
    body: "Some text",
    enabled: true,
    heading: "About",
    id: "blk_rich",
    type: "richText",
    ...overrides,
  };
}

function webinar(overrides: Partial<WebinarBlock> = {}): WebinarBlock {
  return {
    description: "Watch it",
    enabled: true,
    href: "/webinar",
    id: "blk_web",
    thumbnailUrl: "https://example.com/t.png",
    title: "Intro webinar",
    type: "webinar",
    ...overrides,
  };
}

function cta(overrides: Partial<CtaBlock> = {}): CtaBlock {
  return {
    bodySignedOut: "Come on in",
    ctaLabelSignedOut: "Sign up",
    enabled: true,
    headingSignedOut: "Join us",
    id: "blk_cta",
    type: "cta",
    ...overrides,
  };
}

function gallery(overrides: Partial<GalleryBlock> = {}): GalleryBlock {
  return {
    enabled: true,
    heading: "Photos",
    id: "blk_gal",
    subheading: "From meetups",
    type: "gallery",
    ...overrides,
  };
}

const okSave = () => Promise.resolve<SaveHomeResult>({ ok: true });

function renderEditor({
  blocks,
  onSave = vi.fn(okSave),
  permissions = ["pages.edit", "pages.view"] as Permission[],
}: {
  blocks: Block[];
  onSave?: Mock<(blocks: Block[]) => Promise<SaveHomeResult>>;
  permissions?: Permission[];
}) {
  render(
    <PermissionsProvider permissions={permissions}>
      <HomeSectionsEditor initialBlocks={blocks} onSave={onSave} />
    </PermissionsProvider>,
  );
  return { onSave };
}

function sectionCards(): HTMLElement[] {
  return screen.getAllByRole("article");
}

describe("HomeSectionsEditor rendering", () => {
  it("renders one labeled card per block with its fields populated", () => {
    renderEditor({ blocks: [hero(), richText(), webinar(), cta(), gallery()] });
    const cards = sectionCards();
    expect(cards).toHaveLength(5);
    expect(cards[0]).toHaveTextContent("Hero");
    expect(cards[1]).toHaveTextContent("Rich text");
    expect(cards[2]).toHaveTextContent("Webinar");
    expect(cards[3]).toHaveTextContent("CTA");
    expect(cards[4]).toHaveTextContent("Gallery");

    expect(screen.getByLabelText(BADGE_RE)).toHaveValue("New");
    expect(screen.getByLabelText(PRIMARY_CTA_LABEL_RE)).toHaveValue("Join");
    expect(screen.getByLabelText(THUMBNAIL_URL_RE)).toHaveValue("https://example.com/t.png");
    expect(screen.getByLabelText(CTA_LABEL_SIGNED_OUT_RE)).toHaveValue("Sign up");
    expect(screen.getByLabelText(SUBHEADING_RE)).toHaveValue("From meetups");
  });

  it("renders no editable fields for events and discord blocks", () => {
    renderEditor({
      blocks: [
        { enabled: true, id: "blk_ev", type: "events" },
        { enabled: true, id: "blk_dc", type: "discord" },
      ],
    });
    const cards = sectionCards();
    expect(cards[0]).toHaveTextContent("Events");
    expect(cards[1]).toHaveTextContent("Discord");
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("reflects the enabled flag per block", () => {
    renderEditor({ blocks: [hero({ enabled: false }), richText()] });
    const [heroCard, richCard] = sectionCards();
    expect(within(heroCard as HTMLElement).getByRole("checkbox")).not.toBeChecked();
    expect(within(richCard as HTMLElement).getByRole("checkbox")).toBeChecked();
  });
});

describe("HomeSectionsEditor editing", () => {
  it("saves an edited hero heading in the onSave payload", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor({ blocks: [hero({ heading: "" })] });

    await user.type(screen.getByLabelText(HEADING_RE), "Hi");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledOnce();
    const saved = onSave.mock.calls[0]?.[0] as Block[];
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ heading: "Hi", id: "blk_hero", type: "hero" });
    await expect(screen.findByText("Saved")).resolves.toBeInTheDocument();
  });

  it("saves a toggled enabled flag", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor({ blocks: [richText()] });

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    const saved = onSave.mock.calls[0]?.[0] as Block[];
    expect(saved[0]).toMatchObject({ enabled: false, id: "blk_rich" });
  });

  it("edits multiline body via the textarea", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor({ blocks: [richText({ body: "" })] });

    await user.type(screen.getByLabelText(BODY_RE), "long form");
    await user.click(screen.getByRole("button", { name: "Save" }));

    const saved = onSave.mock.calls[0]?.[0] as Block[];
    expect(saved[0]).toMatchObject({ body: "long form", type: "richText" });
  });

  it("shows the error message when save fails", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => Promise.resolve<SaveHomeResult>({ error: "Nope", ok: false }));
    renderEditor({ blocks: [hero()], onSave });

    await user.click(screen.getByRole("button", { name: "Save" }));
    await expect(screen.findByText("Nope")).resolves.toBeInTheDocument();
  });
});

describe("HomeSectionsEditor add and reorder", () => {
  it("adds a hero block", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor({ blocks: [richText()] });

    await user.click(screen.getByRole("button", { name: "Add hero" }));
    expect(sectionCards()).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Save" }));
    const saved = onSave.mock.calls[0]?.[0] as Block[];
    expect(saved).toHaveLength(2);
    expect(saved[1]).toMatchObject({ body: "", enabled: true, heading: "", type: "hero" });
    expect(saved[1]?.id).toMatch(BLK_ID_RE);
  });

  it("adds a richText block", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor({ blocks: [] });

    await user.click(screen.getByRole("button", { name: "Add richText" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    const saved = onSave.mock.calls[0]?.[0] as Block[];
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ type: "richText" });
  });

  it("moves a block down and reorders the saved payload", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor({ blocks: [hero(), richText()] });

    const [heroCard] = sectionCards();
    await user.click(within(heroCard as HTMLElement).getByRole("button", { name: "Move down" }));

    const cards = sectionCards();
    expect(cards[0]).toHaveTextContent("Rich text");
    expect(cards[1]).toHaveTextContent("Hero");

    await user.click(screen.getByRole("button", { name: "Save" }));
    const saved = onSave.mock.calls[0]?.[0] as Block[];
    expect(saved.map((b) => b.id)).toStrictEqual(["blk_rich", "blk_hero"]);
  });

  it("disables Move up on the first block and Move down on the last", () => {
    renderEditor({ blocks: [hero(), richText()] });
    const [first, last] = sectionCards();
    expect(within(first as HTMLElement).getByRole("button", { name: "Move up" })).toBeDisabled();
    expect(within(first as HTMLElement).getByRole("button", { name: "Move down" })).toBeEnabled();
    expect(within(last as HTMLElement).getByRole("button", { name: "Move up" })).toBeEnabled();
    expect(within(last as HTMLElement).getByRole("button", { name: "Move down" })).toBeDisabled();
  });
});

describe("HomeSectionsEditor without pages.edit", () => {
  it("shows the read-only note and hides all action buttons, disabling fields", () => {
    renderEditor({ blocks: [hero()], permissions: ["pages.view"] });

    expect(screen.getByText("You can view this page but not save changes.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByLabelText(HEADING_RE)).toBeDisabled();
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });
});
