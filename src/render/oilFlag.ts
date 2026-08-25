// Whether the country is painted or drawn, and the one place that decides.
//
// A URL flag rather than a setting, because the only thing this is for right
// now is looking at the two side by side on a real phone: open the page with
// `?paint` and the map is painted, open it without and it is not. Nothing is
// remembered, so a stale preference can never be the reason somebody's game
// looks wrong.
//
// `window.landnam.paint(true)` flips it from the console for a browser test,
// which is how the bars drive it. Neither survives a reload on its own.

let override: boolean | null = null;

/** Read once per mount. Never throws: a page without a location still runs. */
export function paintingWanted(): boolean {
  if (override !== null) return override;
  try {
    const search = new URLSearchParams(globalThis.location?.search ?? '');
    return search.has('paint') && search.get('paint') !== '0';
  } catch {
    return false;
  }
}

/** For the debug hook and the browser bars. Takes effect on the next mount. */
export function wantPainting(on: boolean | null): void {
  override = on;
}
