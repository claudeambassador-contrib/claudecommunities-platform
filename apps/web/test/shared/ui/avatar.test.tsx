import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "@/shared/ui/avatar";

describe("Avatar", () => {
  it("renders an image when src is provided", () => {
    render(<Avatar name="Ada Lovelace" src="https://example.com/a.png" />);
    const img = screen.getByRole("img", { name: "Ada Lovelace" });
    expect(img).toHaveAttribute("src", "https://example.com/a.png");
  });

  it("prefers explicit alt over name", () => {
    render(<Avatar alt="Profile photo" name="Ada" src="https://example.com/a.png" />);
    expect(screen.getByRole("img", { name: "Profile photo" })).toBeInTheDocument();
  });

  it("falls back to an empty alt when no alt or name is given", () => {
    const { container } = render(<Avatar src="https://example.com/a.png" />);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("alt", "");
  });

  it("renders the uppercase initial fallback when src is missing", () => {
    render(<Avatar name="ada" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("renders ? when there is no name and no src", () => {
    render(<Avatar />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("renders ? for a whitespace-only name", () => {
    render(<Avatar name="   " />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("applies className to both branches and branch-specific classes", () => {
    const { rerender } = render(
      <Avatar className="shape" imgClassName="ring" name="Ada" src="https://example.com/a.png" />,
    );
    const img = screen.getByRole("img");
    expect(img).toHaveClass("shape", "ring");

    rerender(<Avatar className="shape" fallbackClassName="grad" name="Ada" />);
    const fallback = screen.getByText("A");
    expect(fallback).toHaveClass("shape", "grad");
  });
});
