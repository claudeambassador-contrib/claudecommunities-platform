---
name: export-ambassador-tools
description: Export the 3 admin tools (Attendee Analytics, QR Code Generator, Attendance Planner) into the standalone ambassador-tools Next.js app at ~/devel/ambassador-tools/
---

# Export Ambassador Tools

Re-export the admin tools from this codebase into the standalone `~/devel/ambassador-tools/` app. Use this whenever the source tools have been updated and the standalone app needs to be synced.

## Source → Destination mapping

| Source (this repo) | Destination (ambassador-tools) |
|---|---|
| `src/components/admin/AttendeeAnalytics.tsx` | `src/components/AttendeeAnalytics.tsx` |
| `src/components/admin/QRCodeGenerator.tsx` | `src/components/QRCodeGenerator.tsx` |
| `src/components/admin/AttendancePlanner.tsx` | `src/components/AttendancePlanner.tsx` |
| `src/lib/luma-csv.ts` | `src/lib/luma-csv.ts` |
| `src/lib/services/attendance-evaluator.ts` | `src/lib/services/attendance-evaluator.ts` |
| `src/app/api/admin/tools/attendance-planner/evaluate/route.ts` | `src/app/api/attendance-planner/evaluate/route.ts` |

## Required transformations when copying

1. **Import paths**: Change `@/components/admin/` → `@/components/` in page files
2. **API endpoint**: Change `/api/admin/tools/attendance-planner/evaluate` → `/api/attendance-planner/evaluate` in `AttendancePlanner.tsx`
3. **API route auth**: Remove `getCurrentUser()` check and `@/lib/auth` import from the evaluate route — the standalone app has no auth
4. **API key check**: The standalone route includes a check for `process.env.ANTHROPIC_API_KEY` — preserve this
5. **QR default URL**: Clear the default input text (source has `https://claudecommunity.com.au`, standalone starts empty)
6. **QR logo path**: Change `/icons/favicon.png` → `/favicon.png`
7. **ESLint comment**: Remove `// eslint-disable-next-line @next/next/no-img-element` from QRCodeGenerator (standalone has no next eslint config)

## Files that DON'T need syncing (standalone-only)

These files in the standalone app are independent and should not be overwritten:
- `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`
- `src/app/layout.tsx` (has its own simplified layout with nav header)
- `src/app/page.tsx` (landing page with card links)
- `src/app/attendee-analytics/page.tsx`, `src/app/qr-generator/page.tsx`, `src/app/attendance-planner/page.tsx` (simplified wrappers)
- `src/app/globals.css` (stripped-down version of the original)
- `.env.example`, `.gitignore`

## Steps

1. Read each source file listed above
2. Apply the transformations listed above
3. Write each transformed file to the destination
4. Run `cd ~/devel/ambassador-tools && bun run build` to verify the build passes
5. Commit the changes in the ambassador-tools repo

## Dependencies

The standalone app uses: `next`, `react`, `react-dom`, `qrcode`, `html-to-image`, `lucide-react`, `@ai-sdk/anthropic`, `ai`, `zod`, `geist`, `tailwindcss`, `@tailwindcss/postcss`. If a source file adds a new dependency, add it to the standalone `package.json` and run `bun install`.
