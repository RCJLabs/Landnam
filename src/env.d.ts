/**
 * Values Vite substitutes at build time (see `define` in vite.config.ts).
 *
 * `__BUILD__` is the commit and timestamp the running page was built from.
 * It is shown on the title screen so a stale cached deploy is visible from
 * inside the game rather than something you have to go and check.
 */
declare const __BUILD__: string;
