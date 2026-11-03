import { describe, expect, it } from 'vitest';
import { ElizaEngine } from '../../src/core/ElizaEngine';
import { normalizeInput } from '../../src/language/it/normalizer';
import { reflectFragment } from '../../src/language/it/reflections';
import { tokenize } from '../../src/language/it/tokenizer';
import type {
  DecompositionRule,
  ElizaScript,
  KeywordRule,
  LanguageAdapter,
  PatternTerm,
  ReassemblyRule,
} from '../../src/core/types';

const language: LanguageAdapter = {
  normalizeInput,
  tokenize,
  reflectFragment,
};

const noMatchReplies = ['NO_MATCH_1', 'NO_MATCH_2', 'NO_MATCH_3', 'NO_MATCH_4'] as const;

const memoryTemplates = ['MEMORY_1', 'MEMORY_2', 'MEMORY_3', 'MEMORY_4'] as const;

function reply(id: string, template: string): ReassemblyRule {
  return { id, kind: 'reply', template };
}

function decomposition(
  id: string,
  pattern: readonly PatternTerm[],
  reassemblies: readonly ReassemblyRule[],
): DecompositionRule {
  return { id, pattern, reassemblies };
}

function wholeInputDecomposition(id: string, template: string): DecompositionRule {
  return decomposition(
    id,
    [{ kind: 'wildcard', capture: 'all', min: 0 }],
    [reply(`${id}-reply`, template)],
  );
}

function keyword(
  id: string,
  priority: number,
  decompositions: readonly DecompositionRule[],
  triggerTokens: readonly string[] = [id],
  extra: Partial<Pick<KeywordRule, 'memoryPolicy' | 'redirectTo'>> = {},
): KeywordRule {
  return {
    id,
    priority,
    triggers: [{ tokens: triggerTokens }],
    decompositions,
    ...extra,
  };
}

function script(
  keywords: readonly KeywordRule[],
  overrides: Partial<Omit<ElizaScript, 'keywords'>> = {},
): ElizaScript {
  return {
    keywords,
    fallback: { id: 'fallback', replies: ['NONE_RESULT'] },
    noMatch: { id: 'no-match', replies: noMatchReplies },
    repeat: { id: 'repeat', replies: ['REPEATED_INPUT'] },
    emptyInput: 'EMPTY_INPUT',
    memoryRules: [{ id: 'memory', templates: memoryTemplates }],
    ...overrides,
  };
}

describe('ElizaEngine', () => {
  it('builds the historical keyword stack by new maxima, not global sorting', () => {
    const rules = [
      keyword('uno', 1, [wholeInputDecomposition('uno-d', 'UNO')]),
      keyword('quattro', 4, [wholeInputDecomposition('quattro-d', 'QUATTRO')]),
      keyword('due', 2, [wholeInputDecomposition('due-d', 'DUE')]),
    ];
    const engine = new ElizaEngine(script(rules), language);

    const result = engine.respond('uno quattro due');

    expect(result.trace.keywords.map(({ keywordId }) => keywordId)).toEqual([
      'quattro',
      'uno',
      'due',
    ]);
    expect(result.trace.selectedKeyword).toBe('quattro');
    expect(result.response).toBe('QUATTRO');
  });

  it('matches empty and minimal wildcard captures', () => {
    const emptyRule = keyword('parola', 1, [
      decomposition(
        'empty-capture',
        [
          { kind: 'literal', value: 'io' },
          { kind: 'wildcard', capture: 'middle', min: 0, max: 0 },
          { kind: 'literal', value: 'parola' },
        ],
        [reply('empty-reply', 'VUOTO')],
      ),
    ]);
    const minimalRule = keyword('parola', 1, [
      decomposition(
        'minimal-capture',
        [
          { kind: 'literal', value: 'io' },
          { kind: 'wildcard', capture: 'middle', min: 1, max: 1 },
          { kind: 'literal', value: 'parola' },
        ],
        [reply('minimal-reply', 'MINIMO')],
      ),
    ]);

    const empty = new ElizaEngine(script([emptyRule]), language).respond('io parola');
    const minimal = new ElizaEngine(script([minimalRule]), language).respond('io sola parola');

    expect(empty.trace.captures.middle).toBe('');
    expect(minimal.trace.captures.middle).toBe('sola');
  });

  it('keeps reassembly rotation independent for each decomposition', () => {
    const rule = keyword('parola', 1, [
      decomposition(
        'uno-decomposition',
        [
          { kind: 'literal', value: 'parola' },
          { kind: 'literal', value: 'uno' },
        ],
        [reply('uno-a', 'UNO_A'), reply('uno-b', 'UNO_B')],
      ),
      decomposition(
        'due-decomposition',
        [
          { kind: 'literal', value: 'parola' },
          { kind: 'literal', value: 'due' },
        ],
        [reply('due-a', 'DUE_A'), reply('due-b', 'DUE_B')],
      ),
    ]);
    const engine = new ElizaEngine(script([rule]), language);

    const results = [
      engine.respond('parola uno'),
      engine.respond('parola due'),
      engine.respond('parola uno'),
      engine.respond('parola due'),
    ];

    expect(results.map(({ response }) => response)).toEqual(['UNO_A', 'DUE_A', 'UNO_B', 'DUE_B']);
    expect(results.map(({ trace }) => trace.selectedDecomposition)).toEqual([
      'uno-decomposition',
      'due-decomposition',
      'uno-decomposition',
      'due-decomposition',
    ]);
  });

  it('follows redirect rules and continues after NEWKEY', () => {
    const redirectEngine = new ElizaEngine(
      script([
        keyword('redir', 2, [
          decomposition(
            'redir-d',
            [{ kind: 'wildcard', capture: 'all', min: 0 }],
            [{ id: 'redirect', kind: 'redirect', target: 'dest' }],
          ),
        ]),
        keyword('dest', 1, [wholeInputDecomposition('dest-d', 'DESTINATION')]),
      ]),
      language,
    );
    const newKeyEngine = new ElizaEngine(
      script([
        keyword('alto', 2, [
          decomposition(
            'alto-d',
            [{ kind: 'wildcard', capture: 'all', min: 0 }],
            [{ id: 'next-key', kind: 'newkey' }],
          ),
        ]),
        keyword('basso', 1, [wholeInputDecomposition('basso-d', 'BASSO_RISPOSTA')]),
      ]),
      language,
    );

    const redirected = redirectEngine.respond('redir dest');
    const continued = newKeyEngine.respond('alto basso');

    expect(redirected.response).toBe('DESTINATION');
    expect(redirected.trace.redirectChain).toContain('dest');
    expect(continued.response).toBe('BASSO_RISPOSTA');
    expect(
      continued.trace.decompositions.some(
        (attempt) => attempt.keywordId === 'basso' && attempt.matched,
      ),
    ).toBe(true);
  });

  it('advances LIMIT and selects noMatch by LIMIT after decomposition failures', () => {
    const failedDecomposition = keyword('parola', 1, [
      decomposition(
        'unmatched',
        [{ kind: 'literal', value: 'impossibile' }],
        [reply('unreachable', 'NON_RAGGIUNTO')],
      ),
    ]);
    const engine = new ElizaEngine(script([failedDecomposition]), language);
    const results = ['uno', 'due', 'tre', 'quattro'].map((suffix) =>
      engine.respond(`parola ${suffix}`),
    );

    expect(results.map(({ trace }) => trace.limit)).toEqual([2, 3, 4, 1]);
    expect(results.map(({ response }) => response)).toEqual([
      'NO_MATCH_2',
      'NO_MATCH_3',
      'NO_MATCH_4',
      'NO_MATCH_1',
    ]);
    expect(engine.getState().limit).toBe(1);
  });

  it('uses fallback NONE when no keyword is present', () => {
    const engine = new ElizaEngine(script([]), language);

    const result = engine.respond('senza keyword');

    expect(result.response).toBe('NONE_RESULT');
    expect(result.trace.selectedKeyword).toBeNull();
    expect(result.trace.fallback).toBe('none');
  });

  it('uses repeat replies for consecutive identical input', () => {
    const engine = new ElizaEngine(script([]), language, { mode: 'deterministic' });

    const first = engine.respond('nessuna keyword');
    const repeated = engine.respond('nessuna keyword');

    expect(first.trace.repeated).toBe(false);
    expect(repeated.trace.repeated).toBe(true);
    expect(repeated.response).toBe('REPEATED_INPUT');
  });

  it('keeps FIFO order without treating four MEMORY templates as a queue limit', () => {
    const rememberingKeyword = keyword(
      'ricorda',
      2,
      [wholeInputDecomposition('remember-d', 'RISPOSTA')],
      ['ricorda'],
      { memoryPolicy: { ruleId: 'memory' } },
    );
    const fifoEngine = new ElizaEngine(script([rememberingKeyword]), language);
    const createdAt: number[] = [];

    for (const suffix of ['uno', 'due', 'tre', 'quattro', 'cinque']) {
      const result = fifoEngine.respond(`ricorda ${suffix}`);
      const lastMemory = fifoEngine.getState().memories.at(-1);

      expect(result.trace.memory.created).not.toBeNull();
      expect(lastMemory).toBeDefined();
      if (lastMemory === undefined) throw new Error('Il motore non ha creato memoria');
      createdAt.push(lastMemory.createdAt);
    }

    const fifoState = fifoEngine.getState();
    expect(fifoState.memories).toHaveLength(5);
    expect(fifoState.memories.map(({ createdAt: time }) => time)).toEqual(createdAt);
  });

  it('recalls memory only without a keyword when LIMIT reaches 4', () => {
    const rememberingKeyword = keyword(
      'ricorda',
      2,
      [wholeInputDecomposition('remember-d', 'RISPOSTA')],
      ['ricorda'],
      { memoryPolicy: { ruleId: 'memory' } },
    );
    const ordinaryKeyword = keyword('saluto', 1, [wholeInputDecomposition('saluto-d', 'SALUTO')]);
    const recallEngine = new ElizaEngine(script([rememberingKeyword, ordinaryKeyword]), language);
    recallEngine.respond('ricorda primo');
    const beforeLimitFour = recallEngine.respond('nessuna parola');
    const keywordAtLimitFour = recallEngine.respond('saluto oggi');
    recallEngine.respond('altro uno');
    recallEngine.respond('altro due');
    recallEngine.respond('altro tre');
    const noKeywordAtLimitFour = recallEngine.respond('altro quattro');

    expect(beforeLimitFour.trace.limit).toBe(3);
    expect(beforeLimitFour.trace.memory.recalled).toBeNull();
    expect(keywordAtLimitFour.trace.limit).toBe(4);
    expect(keywordAtLimitFour.trace.selectedKeyword).toBe('saluto');
    expect(keywordAtLimitFour.trace.memory.recalled).toBeNull();
    expect(noKeywordAtLimitFour.trace.limit).toBe(4);
    expect(noKeywordAtLimitFour.trace.memory.recalled).not.toBeNull();
  });

  it('reproduces varied choices from a seed and exposes mode changes', () => {
    const alternatives = keyword('scelta', 1, [
      decomposition(
        'alternatives',
        [{ kind: 'wildcard', capture: 'all', min: 0 }],
        [reply('a', 'A'), reply('b', 'B'), reply('c', 'C'), reply('d', 'D')],
      ),
    ]);
    const variedScript = script([alternatives]);
    const inputs = ['scelta uno', 'scelta due', 'scelta tre', 'scelta quattro'];
    const first = new ElizaEngine(variedScript, language, { mode: 'varied', seed: 7301 });
    const second = new ElizaEngine(variedScript, language, { mode: 'varied', seed: 7301 });
    const firstResults = inputs.map((input) => first.respond(input));
    const secondResults = inputs.map((input) => second.respond(input));

    expect(firstResults.map(({ response }) => response)).toEqual(
      secondResults.map(({ response }) => response),
    );
    expect(firstResults.map(({ trace }) => trace.randomDraws)).toEqual(
      secondResults.map(({ trace }) => trace.randomDraws),
    );
    expect(firstResults.every(({ trace }) => trace.selectionMode === 'varied')).toBe(true);
    expect(firstResults.every(({ trace }) => trace.seed === 7301)).toBe(true);
    expect(firstResults.some(({ trace }) => trace.randomDraws.length > 0)).toBe(true);

    const engine = new ElizaEngine(variedScript, language);
    engine.setMode('deterministic');
    engine.setSeed(91);
    expect(engine.getState()).toMatchObject({ mode: 'deterministic', seed: 91 });
    expect(engine.respond('scelta uno').trace.selectionMode).toBe('deterministic');
  });

  it('resets turn, LIMIT, memories, and the previous input', () => {
    const engine = new ElizaEngine(script([]), language);
    engine.respond('una frase');

    engine.reset();

    expect(engine.getState()).toMatchObject({
      turn: 0,
      limit: 1,
      memories: [],
      previousInput: null,
    });
  });
});
