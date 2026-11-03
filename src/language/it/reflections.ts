import type { ReflectionChange, ReflectionResult, ReflectionRule } from '../../core/types';
import { tokenize } from './tokenizer';
import { ambiguousCliticRules, cliticReflectionRules, preservedClitics } from './clitics';
import { elisionReflectionRules, stableElisions } from './elisions';
import { possessiveReflectionRules, unreflectedPossessives } from './possessives';
import { pronounReflectionRules } from './pronouns';
import { findVerbReflectionRule } from './verbs';

const simpleRules: readonly ReflectionRule[] = [
  ...elisionReflectionRules,
  ...cliticReflectionRules,
  ...pronounReflectionRules,
  ...possessiveReflectionRules,
];

const simpleRuleByForm = new Map(simpleRules.map((rule) => [rule.from, rule] as const));
const ambiguousCliticByForm = new Map(
  ambiguousCliticRules.map((rule) => [rule.from, rule] as const),
);

function preserveCase(original: string, replacement: string): string {
  const lowercase = original.toLocaleLowerCase('it-IT');
  const uppercase = original.toLocaleUpperCase('it-IT');

  if (original === uppercase && original !== lowercase) {
    replacement = replacement.toLocaleUpperCase('it-IT');
  } else {
    const firstCharacter = Array.from(original)[0];
    if (firstCharacter !== undefined) {
      const firstCharacterEnd = firstCharacter.length;
      const rest = original.slice(firstCharacterEnd);
      const titleCase =
        firstCharacter === firstCharacter.toLocaleUpperCase('it-IT') &&
        rest === rest.toLocaleLowerCase('it-IT');

      if (titleCase) {
        const replacementCharacters = Array.from(replacement);
        const firstReplacement = replacementCharacters[0];
        if (firstReplacement !== undefined) {
          replacement =
            firstReplacement.toLocaleUpperCase('it-IT') + replacementCharacters.slice(1).join('');
        }
      }
    }
  }

  const originalApostrophe = original.match(/[\u0027\u2018\u2019\u02BC\uFF07]/u)?.[0];
  if (originalApostrophe !== undefined) {
    replacement = replacement.replace("'", originalApostrophe);
  }
  return replacement;
}

function findSimpleRule(from: string): ReflectionRule | undefined {
  return simpleRuleByForm.get(from);
}

export function reflectFragment(input: string): ReflectionResult {
  const changes: ReflectionChange[] = [];
  const exceptions: string[] = [];
  const reflectedParts: string[] = [];

  for (const token of tokenize(input)) {
    if (token.kind !== 'word') {
      reflectedParts.push(token.original);
      continue;
    }

    const normalized = token.normalized;
    if (ambiguousCliticByForm.has(normalized)) {
      exceptions.push(token.original);
      reflectedParts.push(token.original);
      continue;
    }

    if (
      stableElisions.has(normalized) ||
      preservedClitics.has(normalized) ||
      unreflectedPossessives.has(normalized)
    ) {
      reflectedParts.push(token.original);
      continue;
    }

    const simpleRule = findSimpleRule(normalized);
    const verbRule = simpleRule === undefined ? findVerbReflectionRule(normalized) : undefined;
    const rule = simpleRule ?? verbRule;

    if (rule === undefined) {
      reflectedParts.push(token.original);
      continue;
    }

    const replacement = preserveCase(token.original, rule.to);
    reflectedParts.push(replacement);
    changes.push({
      original: token.original,
      replacement,
      category: simpleRule === undefined ? 'verb' : simpleRule.category,
    });
  }

  return {
    text: reflectedParts.join(''),
    changes,
    safe: exceptions.length === 0,
    exceptions,
  };
}
