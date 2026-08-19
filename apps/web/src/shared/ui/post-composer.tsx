import type { ReactElement } from "react";
import type { FeedSpaceOption } from "@/modules/community/types";
import { formString, useFormSubmit } from "@/shared/ui/use-form-submit";

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
  const { error, handleSubmit, pending } = useFormSubmit({
    resetOnSuccess: true,
    submit: async (fd) => {
      const title = formString(fd, "title").trim();
      const result = await onSubmit({
        citySlug,
        content: formString(fd, "content"),
        spaceId: formString(fd, "spaceId"),
        title: title || undefined,
      });
      if (result.ok) {
        return { ok: true as const };
      }
      return { error: result.error ?? "Could not publish", ok: false as const };
    },
  });

  if (spaces.length === 0) {
    return null;
  }

  return (
    <form className="card stack post-composer" onSubmit={handleSubmit}>
      <label className="field-label">
        Title (optional)
        <input className="field" name="title" />
      </label>
      <label className="field-label">
        Post
        <textarea
          className="field"
          name="content"
          placeholder="Share something with this city"
          required
          rows={4}
        />
      </label>
      <div className="row justify-between">
        <label className="field-label">
          Space
          <select className="field" defaultValue={spaces[0]?.id} name="spaceId" required>
            {spaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-primary" disabled={pending} type="submit">
          {pending ? "Posting…" : "Post"}
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
    </form>
  );
}
