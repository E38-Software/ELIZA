import { describe, expect, it } from 'vitest';
import { matchDecomposition } from '../../src/core/DecompositionMatcher';
import { scanKeywords } from '../../src/core/KeywordMatcher';
import type { KeywordRule, PatternTerm } from '../../src/core/types';
import { tokenize } from '../../src/language/it/tokenizer';

function keywordRule(id: string, priority: number, ...triggers: string[][]): KeywordRule {
  return {
    id,
    priority,
    triggers: triggers.map((tokens) => ({ tokens })),
    decompositions: [],
  };
}

function match(
  pattern: readonly PatternTerm[],
  input: string,
): Readonly<Record<string, string>> | null {
  return matchDecomposition(pattern, tokenize(input), input);
}

describe('scanKeywords', () => {
  it('keeps the C++ stack order instead of globally sorting by priority', () => {
    const rules = [
      keywordRule('cinque', 5, ['cinque']),
      keywordRule('due', 2, ['due']),
      keywordRule('quattro', 4, ['quattro']),
    ];

    expect(
      scanKeywords(tokenize('cinque due quattro'), rules).stack.map(
        ({ candidate }) => candidate.keywordId,
      ),
    ).toEqual(['cinque', 'due', 'quattro']);
  });

  it('puts each newly observed maximum at the front of the stack', () => {
    const rules = [
      keywordRule('due', 2, ['due']),
      keywordRule('quattro', 4, ['quattro']),
      keywordRule('cinque', 5, ['cinque']),
    ];

    expect(
      scanKeywords(tokenize('due quattro cinque'), rules).stack.map(
        ({ candidate }) => candidate.keywordId,
      ),
    ).toEqual(['cinque', 'quattro', 'due']);
  });

  it('preserves equal-priority order and duplicate keyword occurrences', () => {
    const rules = [keywordRule('alfa', 3, ['alfa']), keywordRule('beta', 3, ['beta'])];
    const result = scanKeywords(tokenize('ALFA beta alfa beta'), rules);

    expect(result.stack.map(({ candidate }) => candidate.keywordId)).toEqual([
      'alfa',
      'beta',
      'alfa',
      'beta',
    ]);
    expect(result.stack.map(({ candidate }) => candidate.position)).toEqual([0, 5, 10, 15]);
  });

  it.each([
    ['nessuno, dolore', ['dolore']],
    ['nessuno. dolore', ['dolore']],
    ['nessuno ma dolore', ['dolore']],
  ] as const)('starts a new clause at comma, period, or “ma”: %s', (input, expectedClause) => {
    const result = scanKeywords(tokenize(input), [keywordRule('dolore', 1, ['dolore'])]);

    expect(
      result.clause.filter(({ kind }) => kind === 'word').map(({ normalized }) => normalized),
    ).toEqual(expectedClause);
    expect(result.stack.map(({ candidate }) => candidate.keywordId)).toEqual(['dolore']);
  });

  it('selects the first clause containing a keyword, regardless of later priority', () => {
    const rules = [keywordRule('dolore', 1, ['dolore']), keywordRule('rabbia', 9, ['rabbia'])];
    const result = scanKeywords(tokenize('dolore, rabbia'), rules);

    expect(result.stack.map(({ candidate }) => candidate.keywordId)).toEqual(['dolore']);
    expect(result.clause.some(({ normalized }) => normalized === 'rabbia')).toBe(false);
  });

  it('matches compound triggers and prefers the longest trigger at a position', () => {
    const rule = keywordRule('benessere', 4, ['stare'], ['stare', 'bene']);
    const result = scanKeywords(tokenize('Stare bene oggi'), [rule]);

    expect(result.stack).toHaveLength(1);
    expect(result.stack[0]?.candidate).toMatchObject({
      keywordId: 'benessere',
      trigger: 'stare bene',
      position: 0,
    });
  });

  it('returns an empty stack when no keyword matches', () => {
    const result = scanKeywords(tokenize('nessuno, davvero'), [
      keywordRule('dolore', 1, ['dolore']),
    ]);

    expect(result.stack).toEqual([]);
    expect(
      result.clause.filter(({ kind }) => kind === 'word').map(({ normalized }) => normalized),
    ).toEqual(['davvero']);
  });
});

describe('matchDecomposition', () => {
  it('uses the smallest wildcard capture that satisfies the following anchor', () => {
    const pattern: PatternTerm[] = [
      { kind: 'wildcard', capture: 'prima', min: 1 },
      { kind: 'literal', value: 'bene' },
    ];

    expect(match(pattern, 'molto molto bene')).toEqual({ prima: 'molto molto' });
  });

  it('allows an empty wildcard capture when its minimum is zero', () => {
    const pattern: PatternTerm[] = [
      { kind: 'wildcard', capture: 'prima' },
      { kind: 'literal', value: 'bene' },
    ];

    expect(match(pattern, 'bene')).toEqual({ prima: '' });
  });

  it('backtracks across repeated anchors with multiple wildcards', () => {
    const pattern: PatternTerm[] = [
      { kind: 'wildcard', capture: 'inizio' },
      { kind: 'literal', value: 'che' },
      { kind: 'wildcard', capture: 'centro' },
      { kind: 'literal', value: 'che' },
      { kind: 'literal', value: 'finito' },
      { kind: 'wildcard', capture: 'fine' },
    ];

    expect(match(pattern, 'io che A che B che finito poi')).toEqual({
      inizio: 'io',
      centro: 'A che B',
      fine: 'poi',
    });
  });

  it('captures a fixed number of words and supports a zero count', () => {
    const pattern: PatternTerm[] = [
      { kind: 'count', capture: 'soggetto', count: 2 },
      { kind: 'literal', value: 'felice' },
    ];
    const emptyPattern: PatternTerm[] = [
      { kind: 'count', capture: 'soggetto', count: 0 },
      { kind: 'literal', value: 'felice' },
    ];

    expect(match(pattern, 'sono davvero felice')).toEqual({ soggetto: 'sono davvero' });
    expect(match(emptyPattern, 'felice')).toEqual({ soggetto: '' });
  });

  it('uses token offsets to preserve punctuation inside captured source text', () => {
    const input = '  IO, sono, davvero felice!';
    const pattern: PatternTerm[] = [
      { kind: 'literal', value: 'io' },
      { kind: 'count', capture: 'pensiero', count: 3 },
    ];

    expect(match(pattern, input)).toEqual({ pensiero: 'sono, davvero felice' });
    expect(
      scanKeywords(tokenize(input), [keywordRule('io', 1, ['io'])]).stack[0]?.candidate.position,
    ).toBe(2);
  });

  it('returns null when the pattern or wildcard minimum cannot match', () => {
    expect(match([{ kind: 'literal', value: 'felice' }], 'sono triste')).toBeNull();
    expect(
      match(
        [
          { kind: 'wildcard', capture: 'minimo', min: 2 },
          { kind: 'literal', value: 'felice' },
        ],
        'sono felice',
      ),
    ).toBeNull();
  });
});
