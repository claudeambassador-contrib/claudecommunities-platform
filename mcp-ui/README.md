# mcp-ui

The interactive UI that the MCP server hands to MCP-Apps-capable hosts
(Claude.ai, etc.) when an admin calls `openSpeakerManager` or
`openSlidesPreview`.

## Layout

- `index.html` + `src/main.tsx` — Vite entry, mounts `<App />`.
- `src/App.tsx` — reads which tool opened the iframe via `ontoolresult`
  and renders one of two views.
- `src/views/SpeakerManager.tsx` — per-event speaker CRUD + photo
  upload, talks to the MCP server through `app.callServerTool`
  and posts FormData to `/api/upload/mcp` with the bearer token
  the server attached to `_meta.bearerToken`.
- `src/views/SlidesPreview.tsx` — read-only carousel rendering
  `SlideTemplate × SlideSpeaker` combinations using the shared
  `SlidePreview` component from the parent project.
- `src/lib/callTool.ts` — thin wrapper that parses the JSON text our
  server wraps each tool result with (via `withMcpService`).
- `src/lib/uploadImage.ts` — bearer-auth POST to `/api/upload/mcp`.
- `vite.config.ts` — bundles everything into a single self-contained
  HTML file via `vite-plugin-singlefile`. Aliases `@app/*` to the
  parent project's `src/*` so the slide-generator layouts can be
  shared without copying.

## Build

`scripts/build-mcp-ui.mjs` in the parent project runs `vite build`
here, then writes the inlined HTML as a TypeScript string export at
`src/lib/mcp/ui-bundle.generated.ts`. That file is `.gitignore`d.

It runs automatically as part of `bun run build`, `dev`, `preview`,
`staging:deploy`, `production:deploy`. You can also run it directly:

```bash
bun run build:mcp-ui
```

## Notes

- Tailwind 4 with `@source "../../src/components/slide-generator/**"`
  so it picks up class names used by shared layout components.
- The headshot / logo `<img>` tags use `crossOrigin="anonymous"` so
  `html-to-image` can rasterize them without tainting the canvas;
  this requires `/api/files/<key>` to set
  `Access-Control-Allow-Origin: *` (it does).
