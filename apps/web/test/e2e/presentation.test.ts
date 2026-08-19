import { mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renameSessionVideo } from "../../e2e/utils/presentation";

describe("renameSessionVideo", () => {
  it("renames Playwright's page@ recording to session.webm", async () => {
    const dir = await mkdtemp(join(tmpdir(), "session-webm-"));
    await writeFile(join(dir, "page@abc123.webm"), "webm");
    const renamed = await renameSessionVideo(dir);
    expect(renamed).toBe(join(dir, "session.webm"));
    expect(await readdir(dir)).toEqual(["session.webm"]);
  });
});
