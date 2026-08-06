// Is the page you are looking at the page that is deployed?
//
// The game is one self-contained index.html, which is what makes it work
// offline — and also what makes a stale cache total. When a phone browser
// holds an old copy, every part of the game is old at once, and there is no
// way to tell from the inside. That question came up for real, so the page
// now answers it.
//
// This is the ONE runtime request the build makes, and it is deliberately
// narrow: same-origin, only over http(s), and silent on every failure. Opened
// from file:// it does not fire at all, so hard constraint 1 — the built page
// runs offline with no external requests — still holds exactly.

import { button, el } from './render/svg';

/** Where the deploy writes the commit it built from. */
const STAMP = 'build.txt';

/** The commit this page was built from. */
export function builtFrom(): string {
  return __BUILD__.split(' ')[0] ?? '';
}

/**
 * Asks the server what it is currently serving. Resolves to the deployed
 * commit, or undefined when the question does not apply or cannot be answered
 * — which is most of the time, and never worth telling anybody about.
 */
async function deployedCommit(): Promise<string | undefined> {
  if (!location.protocol.startsWith('http')) return undefined;
  try {
    const response = await fetch(STAMP, { cache: 'no-store' });
    if (!response.ok) return undefined;
    const text = await response.text();
    const sha = text.trim().split(/\s+/)[0];
    return sha ? sha.slice(0, 7) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Checks once, on boot, and puts a bar at the top of the screen if the server
 * has moved on. Tapping it reloads past the cache.
 */
export function watchForNewBuild(): void {
  void deployedCommit().then((deployed) => {
    if (!deployed || deployed === builtFrom()) return;
    document.body.append(freshBanner(deployed));
  });
}

function freshBanner(deployed: string): HTMLElement {
  const bar = el('div', { class: 'stale-banner' }, [
    el('span', {}, [`A newer Landnám is out (${deployed}). This page is ${builtFrom()}.`]),
    button('Reload', () => {
      // A plain reload can be served straight back out of the cache, so ask
      // for the document with a query the cache has never seen.
      const url = new URL(location.href);
      url.searchParams.set('build', deployed);
      location.replace(url.toString());
    }, { class: 'stale-reload' }),
  ]);
  return bar;
}
