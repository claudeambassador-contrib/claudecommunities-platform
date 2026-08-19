import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type FormEvent, useCallback, useState } from "react";
import { ok } from "@/shared/http/errors";
import { guarded } from "@/shared/http/guarded";
import { DeniedCard, PageHeader } from "@/shared/ui/page";
import { RemoteImage } from "@/shared/ui/remote-image";

const loadQr = createServerFn({ method: "GET" })
  .validator((d: { citySlug: string }) => d)
  .handler(({ data }) => guarded(data.citySlug, "tools.use", () => Promise.resolve(ok({}))));

export const Route = createFileRoute("/$citySlug/admin/tools/qr-generator")({
  loader: ({ params }) => loadQr({ data: { citySlug: params.citySlug } }),
  component: QrGeneratorPage,
});

function QrGeneratorPage() {
  const data = Route.useLoaderData();

  if (!data.allowed) {
    return <DeniedCard reason={data.reason} title="QR generator" />;
  }

  return (
    <section className="stack">
      <PageHeader subtitle="Encode any https URL as a QR code." title="QR generator" />
      <QrForm />
    </section>
  );
}

function QrForm() {
  const [value, setValue] = useState("");
  const [src, setSrc] = useState<string | null>(null);

  const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const next = String(fd.get("value") ?? "").trim();
    setValue(next);
    setSrc(
      next
        ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(next)}`
        : null,
    );
  }, []);

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <input className="field" defaultValue={value} name="value" placeholder="https://…" required />
      <button className="btn btn-primary" type="submit">
        Generate
      </button>
      {src ? (
        <RemoteImage
          alt={`QR code for ${value}`}
          className="rounded-xl"
          height={280}
          src={src}
          width={280}
        />
      ) : null}
    </form>
  );
}
