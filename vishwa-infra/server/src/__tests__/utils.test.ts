import { describe, it, expect } from 'vitest';
import { amountInWords, rupeesInWords, financialYear } from '../utils.js';

describe('financialYear', () => {
  it('treats Jan-Mar dates as the end of the FY that started the previous April', () => {
    expect(financialYear('2026-02-15')).toBe('2025-26');
    expect(financialYear('2026-03-31')).toBe('2025-26');
  });

  it('treats Apr-Dec dates as the start of a new FY', () => {
    expect(financialYear('2026-04-01')).toBe('2026-27');
    expect(financialYear('2026-08-20')).toBe('2026-27');
    expect(financialYear('2026-12-31')).toBe('2026-27');
  });
});

describe('amountInWords', () => {
  it('converts basic amounts', () => {
    expect(amountInWords(0)).toBe('Zero');
    expect(amountInWords(19)).toBe('Nineteen');
    expect(amountInWords(100)).toBe('One Hundred');
    expect(amountInWords(4500)).toBe('Four Thousand Five Hundred');
  });

  it('handles lakhs and crores (Indian numbering)', () => {
    expect(amountInWords(100000)).toBe('One Lakh');
    expect(amountInWords(10000000)).toBe('One Crore');
    expect(amountInWords(1234567)).toBe('Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven');
  });

  it('rounds fractional input to the nearest whole rupee', () => {
    expect(amountInWords(99.6)).toBe('One Hundred');
  });
});

describe('rupeesInWords', () => {
  it('appends "Rupees ... Only" with no paise', () => {
    expect(rupeesInWords(500)).toBe('Five Hundred Rupees Only');
  });

  it('includes paise when present', () => {
    expect(rupeesInWords(4500.5)).toBe('Four Thousand Five Hundred Rupees and Fifty Paise Only');
  });
});
