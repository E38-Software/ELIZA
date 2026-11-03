import type { ReflectionRule } from '../../core/types';

export const possessiveReflectionRules: readonly ReflectionRule[] = [
  { from: 'mio', to: 'tuo', category: 'possessive' },
  { from: 'tuo', to: 'mio', category: 'possessive' },
  { from: 'mia', to: 'tua', category: 'possessive' },
  { from: 'tua', to: 'mia', category: 'possessive' },
  { from: 'miei', to: 'tuoi', category: 'possessive' },
  { from: 'tuoi', to: 'miei', category: 'possessive' },
  { from: 'mie', to: 'tue', category: 'possessive' },
  { from: 'tue', to: 'mie', category: 'possessive' },
  { from: 'nostro', to: 'vostro', category: 'possessive' },
  { from: 'vostro', to: 'nostro', category: 'possessive' },
  { from: 'nostra', to: 'vostra', category: 'possessive' },
  { from: 'vostra', to: 'nostra', category: 'possessive' },
  { from: 'nostri', to: 'vostri', category: 'possessive' },
  { from: 'vostri', to: 'nostri', category: 'possessive' },
  { from: 'nostre', to: 'vostre', category: 'possessive' },
  { from: 'vostre', to: 'nostre', category: 'possessive' },
];

export const unreflectedPossessives: ReadonlySet<string> = new Set([
  'suo',
  'sua',
  'suoi',
  'sue',
  'loro',
  'proprio',
  'propria',
  'propri',
  'proprie',
  'altrui',
]);
