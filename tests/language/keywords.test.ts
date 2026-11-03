import { describe, expect, it } from 'vitest';
import type { PatternTerm, ReassemblyRule } from '../../src/core/types';
import { italianScript } from '../../src/language/it/keywords';

function allIds(): string[] {
  return [
    italianScript.fallback.id,
    italianScript.noMatch.id,
    italianScript.repeat.id,
    ...italianScript.memoryRules.map(({ id }) => id),
    ...italianScript.keywords.flatMap((keyword) => [
      keyword.id,
      ...keyword.decompositions.flatMap((decomposition) => [
        decomposition.id,
        ...decomposition.reassemblies.map(({ id }) => id),
      ]),
    ]),
  ];
}

function patternTerms(): PatternTerm[] {
  return italianScript.keywords.flatMap((keyword) =>
    keyword.decompositions.flatMap(({ pattern }) => [...pattern]),
  );
}

function reassemblies(): ReassemblyRule[] {
  return italianScript.keywords.flatMap((keyword) =>
    keyword.decompositions.flatMap(({ reassemblies: rules }) => [...rules]),
  );
}

describe('copione italiano', () => {
  it('uses globally unique IDs for rules, decompositions, replies, and memories', () => {
    const ids = allIds();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolves every redirect to a declared keyword', () => {
    const keywordIds = new Set(italianScript.keywords.map(({ id }) => id));
    const targets = italianScript.keywords.flatMap((keyword) => [
      ...(keyword.redirectTo === undefined ? [] : [keyword.redirectTo]),
      ...keyword.decompositions.flatMap(({ reassemblies: rules }) =>
        rules.flatMap((rule) => (rule.kind === 'redirect' ? [rule.target] : [])),
      ),
    ]);

    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) expect(keywordIds.has(target)).toBe(true);
  });

  it('keeps every alternative and trigger non-empty', () => {
    for (const keyword of italianScript.keywords) {
      expect(keyword.triggers.length).toBeGreaterThan(0);
      for (const trigger of keyword.triggers) {
        expect(trigger.tokens.length).toBeGreaterThan(0);
        expect(trigger.tokens.every((token) => token.trim().length > 0)).toBe(true);
      }
    }

    for (const term of patternTerms()) {
      if (term.kind === 'oneOf') {
        expect(term.values.length).toBeGreaterThan(0);
        expect(term.values.every((value) => value.trim().length > 0)).toBe(true);
      }
    }
  });

  it('defines four personal-memory templates that quote the original input', () => {
    const personalMemory = italianScript.memoryRules.find(({ id }) => id === 'personal');

    expect(personalMemory).toBeDefined();
    expect(personalMemory?.templates).toHaveLength(4);
    expect(personalMemory?.templates.every((template) => template.includes('{{input}}'))).toBe(
      true,
    );
    expect(
      italianScript.keywords.find(({ id }) => id === 'it-possessivi-prima-persona')?.memoryPolicy,
    ).toEqual({ ruleId: 'personal' });
  });

  it('covers requested high-frequency Italian triggers and the gender-preserving feeling pattern', () => {
    const tokens = italianScript.keywords.flatMap((keyword) =>
      keyword.triggers.map(({ tokens: trigger }) => trigger.join(' ')),
    );

    for (const trigger of [
      'madre',
      'padre',
      'genitori',
      'figli',
      'fratelli',
      'sorelle',
      'partner',
      'amici',
      'lavoro',
      'paura',
      'ansia',
      'tristezza',
      'rabbia',
      'felicità',
      'solitudine',
      'sogni',
      'ricordi',
      'bisogno',
      'desidero',
      'non posso',
      'dubbio',
      'certo',
      'perché',
      'simile',
      'diverso',
      'sempre',
      'mai',
      'tutti',
      'nessuno',
      'computer',
      'macchina',
      'chatbot',
      "un'intelligenza artificiale",
      'psicologo',
      'terapia',
      'ciao',
      'sì',
    ]) {
      expect(tokens).toContain(trigger);
    }

    const feelingRule = italianScript.keywords.find(({ id }) => id === 'it-mi-sento');
    expect(feelingRule?.decompositions[0]?.pattern).toEqual([
      { kind: 'literal', value: 'mi' },
      { kind: 'literal', value: 'sento' },
      { kind: 'wildcard', capture: 'stato', min: 1, max: 8 },
    ]);
    expect(feelingRule?.decompositions[0]?.reassemblies[0]).toMatchObject({
      kind: 'reply',
      template: 'Da quanto tempo ti senti {{stato}}?',
    });
  });

  it('keeps LIMIT no-match distinct from the NONE fallback', () => {
    expect(italianScript.noMatch.id).not.toBe(italianScript.fallback.id);
    expect(italianScript.noMatch.replies).toHaveLength(4);
    expect(italianScript.noMatch.replies).not.toEqual(italianScript.fallback.replies);
  });

  it('includes an explicit NEWKEY rotation', () => {
    expect(reassemblies().some(({ kind }) => kind === 'newkey')).toBe(true);
  });
});
