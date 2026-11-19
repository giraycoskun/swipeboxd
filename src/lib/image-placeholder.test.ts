import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import { encodePlaceholder, PLACEHOLDER_WIDTH } from "./image-placeholder";

/** A 400x600 JPEG with a gradient, i.e. something with real detail to lose. */
async function source(width = 400, height = 600): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      raw[i] = (x * 255) / width;
      raw[i + 1] = (y * 255) / height;
      raw[i + 2] = 128;
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
}

test("the placeholder is a data URL at the placeholder width, not 10 px", async () => {
  const url = await encodePlaceholder(await source());
  assert.match(url, /^data:image\/webp;base64,/);

  const bytes = Buffer.from(url.split(",")[1], "base64");
  const meta = await sharp(bytes).metadata();
  assert.equal(meta.width, PLACEHOLDER_WIDTH);
  assert.equal(meta.height, 48); // 400x600 keeps its aspect: 32 wide, 48 tall
});

test("a tall poster placeholder keeps its aspect ratio and stays small", async () => {
  const url = await encodePlaceholder(await source(400, 600));
  const meta = await sharp(Buffer.from(url.split(",")[1], "base64")).metadata();
  assert.ok(meta.height! > meta.width!);
  assert.ok(url.length < 2000, `placeholder is ${url.length} chars`);
});
