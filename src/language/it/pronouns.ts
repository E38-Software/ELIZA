import type { ReflectionRule } from '../../core/types';

export const pronounReflectionRules: readonly ReflectionRule[] = [
  { from: 'io', to: 'tu', category: 'pronoun' },
  { from: 'tu', to: 'io', category: 'pronoun' },
  { from: 'me', to: 'te', category: 'pronoun' },
  { from: 'te', to: 'me', category: 'pronoun' },
  { from: 'mi', to: 'ti', category: 'pronoun' },
  { from: 'ti', to: 'mi', category: 'pronoun' },
  { from: 'noi', to: 'voi', category: 'pronoun' },
  { from: 'voi', to: 'noi', category: 'pronoun' },
];
