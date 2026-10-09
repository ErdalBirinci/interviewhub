import esbuild from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes("--watch");

const sharedEntry = path.resolve(root, "../shared/index.ts");

/** Statik dosyalar dist icine kopyalanir. */
function copyStatic() {
  mkdirSync(path.join(root, "dist"), { recursive: true });
  for (const file of ["manifest.json", "sidepanel.html", "sidepanel.css"]) {
    copyFileSync(path.join(root, file), path.join(root, "dist", file));
  }
}

const common = {
  bundle: true,
  sourcemap: true,
  target: "chrome116",
  logLevel: "info",
  alias: { "@ih/shared": sharedEntry },
};

const builds = [
  { entryPoints: ["src/background.ts"], outfile: "dist/background.js", format: "esm" },
  { entryPoints: ["src/content.ts"], outfile: "dist/content.js", format: "iife" },
  { entryPoints: ["src/sidepanel.ts"], outfile: "dist/sidepanel.js", format: "esm" },
];

copyStatic();

if (watch) {
  const contexts = await Promise.all(builds.map((b) => esbuild.context({ ...common, ...b })));
  await Promise.all(contexts.map((ctx) => ctx.watch()));
  console.log("[extension] izleniyor... (dist/ klasorunu chrome://extensions uzerinden yenileyin)");
} else {
  await Promise.all(builds.map((b) => esbuild.build({ ...common, ...b })));
  console.log("[extension] hazir -> extension/dist");
}
