// Turning a screenshot into something a bar can compare.
//
// Node has no image decoder and this repo will not take a dependency for one,
// so the PNG is decoded here. That is less mad than it sounds: Playwright
// emits 8-bit non-interlaced, and the whole of PNG for that case is "inflate
// the IDAT chunks, then undo one of five per-scanline filters".
//
// The header is CHECKED rather than assumed, and that earned itself on the
// first run: the guess was colour type 6 (RGBA) and Playwright writes type 2
// (RGB) for an opaque screenshot. A decoder that had assumed four bytes a
// pixel would have read every row a third short and handed the bar confident
// nonsense — a signature that looked like a picture and was not one.
import { inflateSync } from 'node:zlib';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Decodes a Playwright PNG to { w, h, px, bpp } — RGB or RGBA. */
export function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('not a PNG');
  let at = 8;
  let w = 0, h = 0, depth = 0, colour = 0, interlace = 0;
  const idat = [];
  while (at < buf.length) {
    const len = buf.readUInt32BE(at);
    const type = buf.toString('ascii', at + 4, at + 8);
    const body = buf.subarray(at + 8, at + 8 + len);
    if (type === 'IHDR') {
      w = body.readUInt32BE(0);
      h = body.readUInt32BE(4);
      depth = body[8];
      colour = body[9];
      interlace = body[12];
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    at += 12 + len;
  }
  if (depth !== 8 || (colour !== 2 && colour !== 6) || interlace !== 0) {
    throw new Error(`unsupported PNG: depth ${depth} colour ${colour} interlace ${interlace}`);
  }
  const bpp = colour === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(w * h * bpp);
  const stride = w * bpp;
  let src = 0;
  for (let y = 0; y < h; y += 1) {
    const filter = raw[src];
    src += 1;
    const row = y * stride;
    const prev = row - stride;
    for (let x = 0; x < stride; x += 1) {
      const rawByte = raw[src + x];
      // a = the same channel one pixel left, b = the byte above.
      const a = x >= bpp ? px[row + x - bpp] : 0;
      const b = y > 0 ? px[prev + x] : 0;
      const c = x >= bpp && y > 0 ? px[prev + x - bpp] : 0;
      let val;
      if (filter === 0) val = rawByte;
      else if (filter === 1) val = rawByte + a;
      else if (filter === 2) val = rawByte + b;
      else if (filter === 3) val = rawByte + ((a + b) >> 1);
      else if (filter === 4) {
        // Paeth: whichever of left, above and above-left the gradient is nearest.
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        val = rawByte + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else throw new Error(`unknown PNG filter ${filter}`);
      px[row + x] = val & 0xff;
    }
    src += stride;
  }
  return { w, h, px, bpp };
}

/** How coarse the signature is. Small enough to be blind to a pixel of
 *  anti-aliasing, big enough to see a band move or a rule stop painting. */
export const GRID_W = 24;
export const GRID_H = 48;

/**
 * A picture reduced to a grid of average brightness.
 *
 * Deliberately NOT a hash. A hash answers "did anything change" and then
 * cannot say what or by how much, which turns every deliberate art change
 * into a coin flip about whether the bar is right. A grid of numbers gives a
 * distance, so the bar can say "the road moved by 31" and a human can decide
 * whether that is the change they meant to make.
 */
export function signature(png) {
  const { w, h, px, bpp } = decodePng(png);
  const cells = new Array(GRID_W * GRID_H).fill(0);
  const counts = new Array(GRID_W * GRID_H).fill(0);
  for (let y = 0; y < h; y += 1) {
    const gy = Math.min(GRID_H - 1, Math.floor((y / h) * GRID_H));
    for (let x = 0; x < w; x += 1) {
      const gx = Math.min(GRID_W - 1, Math.floor((x / w) * GRID_W));
      const i = (y * w + x) * bpp;
      // Rec. 601 luma. Colour is thrown away on purpose: what these bars keep
      // missing is WHERE things are and whether they are painted at all.
      const lum = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
      const g = gy * GRID_W + gx;
      cells[g] += lum;
      counts[g] += 1;
    }
  }
  return cells.map((sum, i) => Math.round(sum / Math.max(1, counts[i])));
}

/** Mean absolute difference, 0 (identical) to 255 (black against white). */
export function distance(a, b) {
  if (!a || !b || a.length !== b.length) return 255;
  let total = 0;
  for (let i = 0; i < a.length; i += 1) total += Math.abs(a[i] - b[i]);
  return total / a.length;
}
