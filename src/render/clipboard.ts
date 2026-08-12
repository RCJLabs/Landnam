// Putting text on the clipboard, from a page that is usually opened off a
// file:// URL.
//
// The order of the two attempts is the whole content of this file, and it is
// backwards from what every example on the web shows. `navigator.clipboard`
// needs a secure context, and the built game is one HTML file a player opens
// from their downloads — so on the platform this game is actually played on,
// the modern API is the one that is not there. The old selection trick runs
// first because it is the path that works, and the async API is the
// fallback for the hosted copy.

/** Puts `text` on the clipboard. False if neither route was allowed. */
export function copyText(text: string): boolean {
  try {
    const holder = document.createElement('textarea');
    holder.value = text;
    holder.setAttribute('readonly', 'true');
    holder.style.position = 'fixed';
    holder.style.opacity = '0';
    document.body.append(holder);
    holder.select();
    const ok = document.execCommand('copy');
    holder.remove();
    if (ok) return true;
  } catch {
    // Fall through to the async API.
  }
  try {
    void navigator.clipboard?.writeText(text);
    return true;
  } catch {
    return false;
  }
}
