import { useEffect, useState } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';
const KEY = 'vishwa_theme';

const resolve = (p: ThemePref): 'light' | 'dark' =>
  p === 'system' ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : p;

export function applyTheme(p: ThemePref) {
  const t = resolve(p);
  document.documentElement.dataset.theme = t;
  document.documentElement.style.colorScheme = t;
}

export function useTheme(): [ThemePref, 'light' | 'dark', (p: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>(() => (localStorage.getItem(KEY) as ThemePref) || 'system');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    applyTheme(pref);
    localStorage.setItem(KEY, pref);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => { if (pref === 'system') { applyTheme('system'); setTick((t) => t + 1); } };
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [pref]);
  return [pref, resolve(pref), setPref];
}
