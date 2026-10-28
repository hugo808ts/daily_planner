// Gera os PNGs dos ícones a partir de public/icons/icon.svg (npm run icons).
import { readFile } from "node:fs/promises";
import sharp from "sharp";

const svg = await readFile("public/icons/icon.svg");
const out = (name) => `public/icons/${name}`;

for (const [name, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180]]) {
  await sharp(svg).resize(size, size).png().toFile(out(name));
}

// Maskable: fundo violeta até a borda e marca dentro da zona segura (~60%).
const mark = await sharp(svg).resize(300, 300).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#6D4AFF" } })
  .composite([{ input: mark, gravity: "center" }])
  .png()
  .toFile(out("icon-maskable-512.png"));
