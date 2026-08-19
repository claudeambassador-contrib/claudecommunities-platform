import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeniedCard, EmptyCard, ItemList, PageHeader, SignInCard } from "@/shared/ui/page";

const MEETUP_RE = /Meetup/;

describe("PageHeader", () => {
  it("renders the title as a heading", () => {
    render(<PageHeader title="Events" />);
    expect(screen.getByRole("heading", { name: "Events" })).toBeInTheDocument();
  });

  it("renders subtitle and actions when provided", () => {
    render(
      <PageHeader
        actions={<button type="button">New event</button>}
        subtitle="Upcoming meetups"
        title="Events"
      />,
    );
    expect(screen.getByText("Upcoming meetups")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New event" })).toBeInTheDocument();
  });

  it("omits subtitle when not provided", () => {
    render(<PageHeader title="Events" />);
    expect(screen.queryByText("Upcoming meetups")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("EmptyCard", () => {
  it("renders its children", () => {
    render(<EmptyCard>Nothing here yet.</EmptyCard>);
    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
  });
});

describe("DeniedCard", () => {
  it("shows default title and default reason", () => {
    render(<DeniedCard />);
    expect(screen.getByRole("heading", { name: "Access denied" })).toBeInTheDocument();
    expect(screen.getByText("You do not have permission to view this page.")).toBeInTheDocument();
  });

  it("shows a custom title and reason", () => {
    render(<DeniedCard reason="Members only." title="Nope" />);
    expect(screen.getByRole("heading", { name: "Nope" })).toBeInTheDocument();
    expect(screen.getByText("Members only.")).toBeInTheDocument();
  });

  it("falls back to the default reason when reason is null", () => {
    render(<DeniedCard reason={null} />);
    expect(screen.getByText("You do not have permission to view this page.")).toBeInTheDocument();
  });
});

describe("SignInCard", () => {
  it("links to /login by default", () => {
    render(<SignInCard />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });

  it("links to a custom href", () => {
    render(<SignInCard href="/auth/start" />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/auth/start");
  });
});

describe("ItemList", () => {
  it("renders the empty message when there are no items", () => {
    render(<ItemList empty="No events yet." items={[]} />);
    expect(screen.getByText("No events yet.")).toBeInTheDocument();
  });

  it("renders items with href as links", () => {
    render(
      <ItemList
        empty="none"
        items={[{ detail: "Sydney", href: "/events/1", id: "1", title: "Meetup" }]}
      />,
    );
    const link = screen.getByRole("link", { name: MEETUP_RE });
    expect(link).toHaveAttribute("href", "/events/1");
    expect(screen.getByText("Sydney")).toBeInTheDocument();
  });

  it("renders items without href as plain articles, not links", () => {
    render(<ItemList empty="none" items={[{ id: "1", title: "Plain item" }]} />);
    expect(screen.getByRole("article")).toHaveTextContent("Plain item");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("omits the detail line when detail is absent", () => {
    render(<ItemList empty="none" items={[{ id: "1", title: "Only title" }]} />);
    const article = screen.getByRole("article");
    expect(article.querySelector(".muted")).toBeNull();
  });
});
