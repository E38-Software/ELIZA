import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        screen: 'var(--screen)',
        terminal: 'var(--terminal)',
        line: 'var(--line)',
        separator: 'var(--separator)',
        phosphor: 'var(--phosphor)',
        'phosphor-strong': 'var(--phosphor-strong)',
        quiet: 'var(--quiet)',
      },
      fontFamily: {
        terminal: 'var(--font-terminal)',
        interface: 'var(--font-interface)',
      },
    },
  },
  plugins: [],
} satisfies Config;
