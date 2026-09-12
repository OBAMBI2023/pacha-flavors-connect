// Regenerates public/icons/icon-{192,512}-maskable.png from the existing
// SAOVIA Food logo (public/icons/icon-512.png). Run manually with
// `node scripts/generate-maskable-icons.mjs` whenever the source logo
// changes -- this is not wired into `npm run build` since the source logo
// itself changes far less often than the app.
//
// Before this script existed, all five files under public/icons/ were
// byte-identical copies of the same 1254x1254 logo, including the two
// declared with manifest purpose "maskable". A maskable icon needs to be
// treated differently from an "any" icon: Android's adaptive-icon system
// applies an OS-chosen mask (circle, squircle, rounded square, ...) to the
// *entire* image, so any logo content sitting near the edges gets clipped.
// The spec's safe zone is the centered circle whose diameter is 80% of the
// icon's edge length (radius 0.4x) -- see
// https://www.w3.org/TR/appmanifest/#icon-masks and
// https://web.dev/articles/maskable-icon.
//
// The source logo is a flat square tile (a rounded-rect border drawn right
// up to its own edges, with the SAOVIA Food wordmark/cloche/phone artwork
// inset within that border). To guarantee the *entire* square -- border
// included, not just the artwork -- survives a strict circular mask, the
// square's own corners (at distance (side/2)*sqrt(2) from center) must sit
// inside that 0.4x-radius circle, which bounds how large the square can be
// drawn: side <= 0.4 / (sqrt(2)/2) ~= 0.5657 of the icon size. SAFE_SCALE
// below is set slightly under that bound.
import { createCanvas, loadImage } from "canvas";
import { writeFile } from "node:fs/promises";

const SOURCE_LOGO = "public/icons/icon-512.png";
const BACKGROUND_COLOR = "#ffffff"; // matches manifest.webmanifest's background_color and the logo's own background
const SAFE_SCALE = 0.55; // fraction of icon size the full square logo (border included) is drawn at

const TARGETS = [
  { size: 192, out: "public/icons/icon-192-maskable.png" },
  { size: 512, out: "public/icons/icon-512-maskable.png" },
];

const logo = await loadImage(SOURCE_LOGO);

for (const { size, out } of TARGETS) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, size, size);

  const drawSize = Math.round(size * SAFE_SCALE);
  const offset = Math.round((size - drawSize) / 2);
  ctx.drawImage(logo, offset, offset, drawSize, drawSize);

  await writeFile(out, canvas.toBuffer("image/png"));
  console.log(
    `[generate-maskable-icons] wrote ${out} (${size}x${size}, logo drawn at ${drawSize}x${drawSize})`,
  );
}
