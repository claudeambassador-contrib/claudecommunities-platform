import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/$citySlug/membership")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/$citySlug/membership"!</div>;
}
