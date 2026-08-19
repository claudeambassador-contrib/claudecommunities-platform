import { useRouter } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { type FormEvent, useCallback, useState } from "react";
import type { FeedSpaceOption } from "@/modules/community/types";

export interface PostComposerProps {
  citySlug: string;
  onSubmit: (input: {
    citySlug: string;
    content: string;
    spaceId: string;
    title?: string;
  }) => Promise<{ error?: string; ok: boolean }>;
  spaces: FeedSpaceOption[];
}

export function PostComposer({
  citySlug,
  onSubmit,
  spaces,
}: PostComposerProps): ReactElement | null {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const fd = new FormData(form);
      const title = String(fd.get("title") ?? "").trim();
      const result = await onSubmit({
        citySlug,
        content: String(fd.get("content") ?? ""),
        spaceId: String(fd.get("spaceId") ?? ""),
        title: title || undefined,
      });
      if (result.ok) {
        form.reset();
        setStatus(null);
        await router.invalidate();
        return;
      }
      setStatus(result.error ?? "Could not publish");
    },
    [citySlug, onSubmit, router],
  );

  if (spaces.length === 0) {
    return null;
  }

  return (
    <form className="card stack post-composer" onSubmit={handleSubmit}>
      <input className="field" name="title" placeholder="Title (optional)" />
      <textarea
        className="field"
        name="content"
        placeholder="Share something with this city"
        required
        rows={4}
      />
      <div className="row" style={{ justifyContent: "space-between" }}>
        <select className="field" defaultValue={spaces[0]?.id} name="spaceId" required>
          {spaces.map((space) => (
            <option key={space.id} value={space.id}>
              {space.name}
            </option>
          ))}
        </select>
        <button className="btn btn-primary" type="submit">
          Post
        </button>
      </div>
      {status ? <p className="muted">{status}</p> : null}
    </form>
  );
}
