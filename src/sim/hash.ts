// One hash, for the places that pin a whole state.
//
// FNV-1a over the serialized state. `test/orders.test.ts` has had a copy of
// these eight lines since 12.2 and `scripts/play.mjs` needed the same one;
// two copies of a hash function is two ways for a pinned fixture and the
// thing that pinned it to disagree about what they pinned.
//
// Not cryptographic and does not need to be: it exists to notice that a run
// came out different, and any collision it could have would need the two
// states to differ in a way nobody chose.

export function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
