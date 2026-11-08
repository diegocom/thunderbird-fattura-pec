import { build } from "esbuild";
import { cp, mkdir } from "node:fs/promises";

await mkdir("dist/extension", { recursive: true });
await cp("extension", "dist/extension", { recursive: true });
await build({
  entryPoints: ["src/preview.js", "src/pdf.js"],
  outdir: "dist/extension",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "firefox153",
});

const notices = {
  "postal-mime": "LICENSE.txt",
  "asn1js": "LICENSE",
  "@peculiar/utils": "LICENSE",
  "pdfmake": "LICENSE",
};
await mkdir("dist/extension/licenses", { recursive: true });
for (const [dependency, license] of Object.entries(notices)) {
  await cp(`node_modules/${dependency}/${license}`,
    `dist/extension/licenses/${dependency.replace("@", "").replace("/", "-")}.txt`);
}
