import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const body = JSON.stringify(
  {
    version: 1,
    include: ["/*"],
    exclude: ["/assets/*", "/dict/*", "/favicon.svg", "/og.jpg", "/__grok/*"],
  },
  null,
  2,
);

const targets = ["dist/_routes.json", ".output/public/_routes.json"];
for (const rel of targets) {
  const path = join(process.cwd(), rel);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${body}\n`);
}
