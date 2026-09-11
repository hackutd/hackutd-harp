/**
 * Recovers from a page that outlived a deploy.
 *
 * Every route is lazy-loaded from a content-hashed chunk, so a tab or
 * home-screen PWA that was open before a deploy still holds the previous
 * build's chunk names. The first navigation after the deploy asks the server
 * for a file that no longer exists, the dynamic import rejects, and the router
 * would show the 500 page for what is really "you need the new build". Vite
 * dispatches `vite:preloadError` for exactly that failure; a reload picks up
 * the current shell and its chunks.
 *
 * One reload per short window: if the fresh build also fails to load, the
 * problem is not staleness and the error should surface instead of looping.
 */
const RELOAD_STAMP_KEY = "harp:stale-chunk-reload";
const RELOAD_COOLDOWN_MS = 10_000;

export function installStaleChunkReload(): void {
  window.addEventListener("vite:preloadError", (event) => {
    const last = Number(sessionStorage.getItem(RELOAD_STAMP_KEY) ?? 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return;

    sessionStorage.setItem(RELOAD_STAMP_KEY, String(Date.now()));
    event.preventDefault();
    window.location.reload();
  });
}
