import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

// Resolve a local CLI binary in a cross-platform, package-manager-agnostic way.
// Bun writes a `<name>.exe` shim, npm writes `<name>.cmd`, and POSIX writes the
// extensionless `<name>`. Pick the first that exists.
const binDir = join(process.cwd(), "node_modules", ".bin");

function runBin(name, args) {
  const candidates =
    process.platform === "win32" ? [`${name}.exe`, `${name}.cmd`, `${name}.bat`] : [name];
  const bin = candidates.map((c) => join(binDir, c)).find(existsSync);
  if (!bin) {
    throw new Error(`${name} CLI not found in ${binDir} (looked for: ${candidates.join(", ")})`);
  }
  // `.cmd`/`.bat` need a shell on Windows; `.exe` and POSIX binaries do not.
  execFileSync(bin, args, { stdio: "inherit", shell: /\.(cmd|bat)$/i.test(bin) });
}

runBin("prisma", ["generate"]);

// Precompute the tenant-isolation maps from the freshly-generated DMMF. Run as a
// SEPARATE process (after generate) so it loads the just-generated client — never
// inline the DMMF read here (an ESM `import "@prisma/client"` would hoist above
// the generate call and read a stale/absent client). See
// scripts/gen-tenant-scope-maps.ts for why these are static (edge-safe).
runBin("tsx", ["scripts/gen-tenant-scope-maps.ts"]);
