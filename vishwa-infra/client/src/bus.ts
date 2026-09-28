/** Tiny framework-free event bus so non-React code (api helpers) can raise toasts and confirmations. */
export type ToastKind = 'success' | 'error' | 'info';
export type ToastItem = { id: number; kind: ToastKind; title: string; text?: string };
export type ConfirmOpts = { title: string; message?: string; confirmLabel?: string; danger?: boolean };
export type ConfirmReq = ConfirmOpts & { resolve: (v: boolean) => void };

const toastListeners = new Set<(t: ToastItem) => void>();
let seq = 1;

export function toast(title: string, kind: ToastKind = 'info', text?: string) {
  const item: ToastItem = { id: seq++, kind, title, text };
  toastListeners.forEach((fn) => fn(item));
}
export function onToast(fn: (t: ToastItem) => void) {
  toastListeners.add(fn);
  return () => { toastListeners.delete(fn); };
}

let confirmListener: ((r: ConfirmReq) => void) | null = null;
export function onConfirm(fn: (r: ConfirmReq) => void) {
  confirmListener = fn;
  return () => { if (confirmListener === fn) confirmListener = null; };
}
export function confirmDialog(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => {
    if (!confirmListener) { resolve(window.confirm(opts.title)); return; }
    confirmListener({ ...opts, resolve });
  });
}
