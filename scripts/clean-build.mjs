import { rm } from "node:fs/promises";

for (const directory of ["build", "dist", "dist-electron"]) {
  await rm(directory, { recursive: true, force: true });
}
