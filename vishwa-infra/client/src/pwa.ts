// Captures the browser's native install prompt (Chrome/Edge on desktop and
// Android fire `beforeinstallprompt`; Safari on iOS never does — there,
// installing is a manual "Add to Home Screen" from the Share menu, which we
// just give written instructions for instead). Module-level state because
// the event can fire before any component mounts, and only fires once per
// page load, so nothing here can be a plain useState in a component.
let deferredPrompt: any = null;
let listeners: Array<() => void> = [];

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    listeners.forEach((l) => l());
  });
}

export const isInstallAvailable = () => !!deferredPrompt;

export function onInstallAvailabilityChange(fn: () => void): () => void {
  listeners.push(fn);
  return () => { listeners = listeners.filter((l) => l !== fn); };
}

/** Shows the browser's install dialog. Resolves 'unavailable' if the browser hasn't offered one (already installed, unsupported browser, or too early). */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return choice.outcome;
}

/** True if already running as an installed app (standalone window), not a normal browser tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
}
