import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Permission } from "@/shared/auth/permissions";
import { Can, PermissionsProvider, useCan, usePermissionsSet } from "@/shared/ui/can";

function renderWithPerms(perms: readonly Permission[], ui: React.ReactNode) {
  return render(<PermissionsProvider permissions={perms}>{ui}</PermissionsProvider>);
}

describe("Can", () => {
  it("renders children when the permission is granted", () => {
    renderWithPerms(
      ["pages.edit"],
      <Can permission="pages.edit">
        <button type="button">Save</button>
      </Can>,
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("renders nothing by default when the permission is missing", () => {
    renderWithPerms(
      ["pages.view"],
      <Can permission="pages.edit">
        <button type="button">Save</button>
      </Can>,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders the fallback when the permission is missing", () => {
    renderWithPerms(
      [],
      <Can fallback={<span>Read-only</span>} permission="pages.edit">
        <button type="button">Save</button>
      </Can>,
    );
    expect(screen.getByText("Read-only")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("requires ALL permissions when given an array (AND semantics)", () => {
    renderWithPerms(
      ["events.edit"],
      <Can fallback={<span>denied</span>} permission={["events.edit", "events.delete"]}>
        <span>allowed</span>
      </Can>,
    );
    expect(screen.getByText("denied")).toBeInTheDocument();
  });

  it("passes with an array when every permission is granted", () => {
    renderWithPerms(
      ["events.edit", "events.delete"],
      <Can permission={["events.edit", "events.delete"]}>
        <span>allowed</span>
      </Can>,
    );
    expect(screen.getByText("allowed")).toBeInTheDocument();
  });

  it("denies everything outside a PermissionsProvider", () => {
    render(
      <Can fallback={<span>denied</span>} permission="pages.view">
        <span>allowed</span>
      </Can>,
    );
    expect(screen.getByText("denied")).toBeInTheDocument();
  });
});

describe("useCan", () => {
  function Probe({ permission }: { permission: Permission | Permission[] }) {
    const can = useCan();
    return <output>{can(permission) ? "yes" : "no"}</output>;
  }

  it("returns true for a granted permission", () => {
    renderWithPerms(["users.view"], <Probe permission="users.view" />);
    expect(screen.getByRole("status")).toHaveTextContent("yes");
  });

  it("returns false for a missing permission", () => {
    renderWithPerms(["users.view"], <Probe permission="users.edit" />);
    expect(screen.getByRole("status")).toHaveTextContent("no");
  });
});

describe("usePermissionsSet", () => {
  function Probe() {
    const set = usePermissionsSet();
    return <output>{[...set].sort().join(",")}</output>;
  }

  it("exposes the raw granted set", () => {
    renderWithPerms(["cities.view", "cities.edit"], <Probe />);
    expect(screen.getByRole("status")).toHaveTextContent("cities.edit,cities.view");
  });
});
