import { copyFile, mkdir, writeFile } from "node:fs/promises";

await mkdir("dist-electron", { recursive: true });
await mkdir("dist-electron/assets", { recursive: true });
await writeFile(
  "dist-electron/package.json",
  JSON.stringify(
    {
      name: "archy-afk-runtime",
      productName: "ArchyAfk",
      description: "ArchyAfk desktop runtime",
      author: "Apeiron_Only",
      type: "commonjs"
    },
    null,
    2
  )
);
await copyFile("assets/logo.png", "dist-electron/assets/logo.png");
await copyFile("assets/logo.ico", "dist-electron/assets/logo.ico");
