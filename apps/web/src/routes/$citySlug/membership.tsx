import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";

export const Route = createFileRoute("/$citySlug/membership")({
  component: RouteComponent,
});

function RouteComponent(): ReactElement {
  return <div>Hello "/$citySlug/membership"!</div>;
}
