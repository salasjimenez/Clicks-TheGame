import { rm, mkdir } from "node:fs/promises";

await rm(new URL("../assets/js/", import.meta.url), {
  recursive: true,
  force: true,
});
await mkdir(new URL("../assets/js/", import.meta.url), { recursive: true });
