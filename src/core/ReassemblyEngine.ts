import type { LanguageAdapter, ReassemblyRule, ReflectionChange } from './types';

export interface ReassemblyResult {
  readonly text: string | null;
  readonly changes: readonly ReflectionChange[];
  readonly exceptions: readonly string[];
  readonly usedFallback: boolean;
}

export function reassemble(
  rule: Extract<ReassemblyRule, { kind: 'reply' }>,
  captures: Readonly<Record<string, string>>,
  language: LanguageAdapter,
): ReassemblyResult {
  const values = { ...captures };
  const changes: ReflectionChange[] = [];
  const exceptions: string[] = [];
  let unsafe = false;

  for (const name of rule.reflect ?? []) {
    const value = values[name];
    if (value === undefined) {
      exceptions.push(`Cattura non disponibile: ${name}`);
      unsafe = true;
      continue;
    }
    const reflection = language.reflectFragment(value);
    values[name] = reflection.text;
    changes.push(...reflection.changes);
    exceptions.push(...reflection.exceptions);
    if (!reflection.safe) unsafe = true;
  }

  if (unsafe) {
    return { text: rule.unsafeFallback ?? null, changes, exceptions, usedFallback: true };
  }

  let missing = false;
  const text = rule.template.replace(
    /\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/gu,
    (_match, name: string) => {
      const value = values[name];
      if (value === undefined) {
        missing = true;
        exceptions.push(`Cattura non disponibile: ${name}`);
        return '';
      }
      return value;
    },
  );

  if (missing || /\{\{|\}\}/u.test(text) || !text.trim()) {
    return { text: rule.unsafeFallback ?? null, changes, exceptions, usedFallback: true };
  }

  return { text: text.trim(), changes, exceptions, usedFallback: false };
}
