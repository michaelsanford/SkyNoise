import { useState } from 'react';

/**
 * Test stand-in for `virtual:pwa-register/react`.
 *
 * That module is synthesised by vite-plugin-pwa at build time and does not
 * resolve under Vitest. Aliased in only for tests (via `test.alias`), so the
 * production build still gets the real implementation.
 *
 * Mirrors the real hook's shape: two [value, setter] tuples and an updater.
 * `needRefresh` starts false so the update banner is absent by default; a test
 * that wants the banner should drive it through the returned setter.
 */
export function useRegisterSW() {
  const needRefresh = useState(false);
  const offlineReady = useState(false);
  return {
    needRefresh,
    offlineReady,
    updateServiceWorker: async (_reloadPage?: boolean) => {}
  };
}
