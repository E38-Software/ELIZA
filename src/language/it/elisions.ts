import type { ReflectionRule } from '../../core/types';

export const elisionReflectionRules: readonly ReflectionRule[] = [
  { from: "l'ho", to: "l'hai", category: 'elision' },
  { from: "l'hai", to: "l'ho", category: 'elision' },
];

export const stableElisions: ReadonlySet<string> = new Set(["c'è", "com'è", "cos'è"]);
