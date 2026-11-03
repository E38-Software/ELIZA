import type { ReflectionRule } from '../../core/types';

export const cliticReflectionRules: readonly ReflectionRule[] = [
  { from: 'sentirmi', to: 'sentirti', category: 'clitic' },
  { from: 'sentirti', to: 'sentirmi', category: 'clitic' },
  { from: 'vedermi', to: 'vederti', category: 'clitic' },
  { from: 'vederti', to: 'vedermi', category: 'clitic' },
  { from: 'capirmi', to: 'capirti', category: 'clitic' },
  { from: 'capirti', to: 'capirmi', category: 'clitic' },
];

export const ambiguousCliticRules: readonly ReflectionRule[] = [
  { from: 'dimmi', to: 'dimmi', category: 'exception' },
  { from: 'parlami', to: 'parlami', category: 'exception' },
  { from: 'spiegami', to: 'spiegami', category: 'exception' },
  { from: 'raccontami', to: 'raccontami', category: 'exception' },
  { from: 'ci', to: 'ci', category: 'exception' },
  { from: 'vi', to: 'vi', category: 'exception' },
  { from: 'pensarci', to: 'pensarci', category: 'exception' },
];

export const preservedClitics: ReadonlySet<string> = new Set([
  'lo',
  'la',
  'li',
  'le',
  'gli',
  'ne',
  'parlarne',
]);
