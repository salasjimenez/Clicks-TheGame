import { copyFile, mkdir } from "node:fs/promises";

await mkdir(new URL("../assets/css/", import.meta.url), { recursive: true });
await copyFile(
  new URL("../src/styles.css", import.meta.url),
  new URL("../assets/css/styles.css", import.meta.url),
);
