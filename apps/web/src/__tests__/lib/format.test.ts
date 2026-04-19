import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatCpfCnpj,
  formatPhone,
  formatPercent,
  parseCurrencyInput,
  truncate,
} from '@/lib/format';

describe('formatCurrency', () => {
  it('formats positive number', () => {
    expect(formatCurrency(1234.56)).toMatch(/1\.234,56/);
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toMatch(/0,00/);
  });

  it('handles null', () => {
    expect(formatCurrency(null)).toMatch(/0,00/);
  });

  it('handles undefined', () => {
    expect(formatCurrency(undefined)).toMatch(/0,00/);
  });

  it('handles NaN string', () => {
    expect(formatCurrency('abc')).toMatch(/0,00/);
  });

  it('formats string number', () => {
    expect(formatCurrency('999.99')).toMatch(/999,99/);
  });

  it('formats negative value', () => {
    const r = formatCurrency(-50);
    expect(r).toMatch(/50/); // Negative in pt-BR notation
  });
});

describe('formatDate', () => {
  it('formats valid ISO date', () => {
    expect(formatDate('2026-05-15')).toBe('15/05/2026');
  });

  it('returns dash for null', () => {
    expect(formatDate(null)).toBe('-');
  });

  it('returns dash for undefined', () => {
    expect(formatDate(undefined)).toBe('-');
  });

  it('returns dash for invalid date', () => {
    expect(formatDate('not-a-date')).toBe('-');
  });

  it('formats Date object', () => {
    expect(formatDate(new Date('2026-01-01T12:00:00Z'))).toMatch(/01\/01\/2026/);
  });

  it('accepts custom pattern', () => {
    expect(formatDate('2026-05-15', 'MM/yyyy')).toBe('05/2026');
  });
});

describe('formatDateTime', () => {
  it('formats with time', () => {
    const result = formatDateTime('2026-05-15T10:30:00Z');
    expect(result).toMatch(/15\/05\/2026/);
  });

  it('returns dash for null', () => {
    expect(formatDateTime(null)).toBe('-');
  });
});

describe('formatCpfCnpj', () => {
  it('formats CPF', () => {
    expect(formatCpfCnpj('12345678901')).toBe('123.456.789-01');
  });

  it('formats CNPJ', () => {
    expect(formatCpfCnpj('12345678000190')).toBe('12.345.678/0001-90');
  });

  it('returns dash for null', () => {
    expect(formatCpfCnpj(null)).toBe('-');
  });

  it('strips non-digits before formatting', () => {
    expect(formatCpfCnpj('123.456.789-01')).toBe('123.456.789-01');
  });

  it('returns raw for unexpected length', () => {
    expect(formatCpfCnpj('12345')).toBe('12345');
  });
});

describe('formatPhone', () => {
  it('formats 11-digit mobile', () => {
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
  });

  it('formats 10-digit landline', () => {
    expect(formatPhone('1132145678')).toBe('(11) 3214-5678');
  });

  it('returns dash for null', () => {
    expect(formatPhone(null)).toBe('-');
  });
});

describe('formatPercent', () => {
  it('formats percentage', () => {
    expect(formatPercent(12.5)).toBe('12,5%');
  });

  it('returns dash for null', () => {
    expect(formatPercent(null)).toBe('-');
  });

  it('uses custom digits', () => {
    expect(formatPercent(12.567, 2)).toBe('12,57%');
  });
});

describe('parseCurrencyInput', () => {
  it('parses Brazilian format', () => {
    expect(parseCurrencyInput('1.234,56')).toBe(1234.56);
  });

  it('parses integer', () => {
    expect(parseCurrencyInput('100')).toBe(100);
  });

  it('handles empty string', () => {
    expect(parseCurrencyInput('')).toBe(0);
  });

  it('handles R$ prefix', () => {
    expect(parseCurrencyInput('R$ 1.234,56')).toBe(1234.56);
  });
});

describe('truncate', () => {
  it('truncates long text', () => {
    expect(truncate('a'.repeat(80), 60)).toBe('a'.repeat(60) + '...');
  });

  it('does not truncate short text', () => {
    expect(truncate('short', 60)).toBe('short');
  });

  it('handles empty string', () => {
    expect(truncate('')).toBe('');
  });
});
