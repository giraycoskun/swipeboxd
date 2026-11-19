import sharp from "sharp";

/**
 * The loading placeholder behind every poster and backdrop.
 *
 * It is deliberately tiny, but 10 px was too tiny: Phase 7 removed the CSS
 * `filter: blur()` that used to hide the upscale (a per-card paint layer inside
 * the dragged card, #101), which left a 10x6 JPEG stretched over a 685x326 hero —
 * 68x, i.e. visible pixel blocks. Forty pixels of source plus a blur baked in
 * sharp is a smooth field at the same weight (about 1 KB), and still needs no
 * CSS filter on the client.
 */
export const PLACEHOLDER_WIDTH = 32;
export const PLACEHOLDER_QUALITY = 45;
/** Sharp's sigma at placeholder scale; ~1.6 of 32 px reads as ~40 px of blur at full size. */
export const PLACEHOLDER_BLUR = 1.6;

export async function encodePlaceholder(buffer: Buffer): Promise<string> {
  const { data, info } = await sharp(buffer)
    .resize(PLACEHOLDER_WIDTH)
    .blur(PLACEHOLDER_BLUR)
    .webp({ quality: PLACEHOLDER_QUALITY })
    .toBuffer({ resolveWithObject: true });

  return `data:image/${info.format};base64,${data.toString("base64")}`;
}
