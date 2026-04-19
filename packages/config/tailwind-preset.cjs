/** Tailwind preset compartilhado (design system MONEY MIND). */
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#2563EB', foreground: '#FFFFFF' },
        'status-aberto': '#22C55E',
        'status-pago': '#6B7280',
        'status-atrasado': '#EF4444',
        'status-cancelado': '#9CA3AF',
        'status-emitido': '#3B82F6',
        'status-recebido': '#16A34A',
        'status-previsto': '#F59E0B',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
