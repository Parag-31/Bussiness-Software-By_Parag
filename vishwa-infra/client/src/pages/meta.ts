import { Clock3, HardHat, Receipt, Wrench, WalletCards, Banknote, Landmark, Smartphone, CreditCard, FileCheck2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type TypeMeta = { label: string; short: string; tone: string; icon: LucideIcon };
const TYPES: Record<string, TypeMeta> = {
  'GST INVOICE': { label: 'GST Invoice', short: 'Invoice', tone: 'blue', icon: Receipt },
  QUOTATION: { label: 'Quotation', short: 'Quote', tone: 'amber', icon: Clock3 },
  'REPAIR BILL': { label: 'Repair Bill', short: 'Repair', tone: 'violet', icon: Wrench },
  'WORK ORDER': { label: 'Work Order', short: 'Work order', tone: 'cyan', icon: HardHat },
};
export const typeMeta = (t: string): TypeMeta => TYPES[t] || { label: t, short: t, tone: 'blue', icon: Receipt };

export const modeIcon = (mode?: string): LucideIcon => {
  switch ((mode || '').toLowerCase()) {
    case 'cash': return Banknote;
    case 'bank transfer': return Landmark;
    case 'upi': return Smartphone;
    case 'cheque': return FileCheck2;
    case 'card': return CreditCard;
    default: return WalletCards;
  }
};
