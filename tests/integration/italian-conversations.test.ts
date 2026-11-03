import { describe, expect, it } from 'vitest';
import { normalizeInput } from '../../src/language/it/normalizer';
import { createItalianEngine } from '../../src/language/it/index';

const conversationInputs = [
  'Io sono triste.',
  'Tu non mi capisci.',
  'Mia madre non mi ascolta.',
  'Mio padre pensa che io sia pigro.',
  'Mio padre pensa che io sia pigra.',
  'Ho paura di fallire.',
  'Non voglio parlarne.',
  'Mi sento sempre così.',
  'Nessuno mi considera.',
  'Vorrei essere più tranquillo.',
  'Vorrei essere più tranquilla.',
  'Perché mi fai questa domanda?',
  'Sei una macchina?',
  "Sei un'intelligenza artificiale?",
  "Non c'è niente che possa fare.",
  "L'ho detto a mia sorella.",
  'Parlarne mi mette ansia.',
  'Non so.',
  'Boh.',
  'Forse.',
  'Sì.',
  'No.',
  '...',
  '',
  '   \t\n',
  'L’ho detto a mia sorella.',
  'IO SONO TRISTE.',
  'Mia madre non mi ascoltaa.',
  'io sono triste '.repeat(120),
] as const;

function expectUsableResult(input: string): void {
  const engine = createItalianEngine({ mode: 'deterministic', seed: 20261103 });
  const result = engine.respond(input);

  expect(result.response.trim().length).toBeGreaterThan(0);
  expect(result.response).not.toMatch(/\b(?:undefined|null)\b|\{\{[^}]*\}\}|\$\{[^}]*\}|<[^>]+>/iu);
  expect(result.trace).toMatchObject({
    originalInput: input,
    normalizedInput: normalizeInput(input),
    response: result.response,
    selectionMode: 'deterministic',
  });
  expect(result.trace.activeClause).toEqual(expect.any(String));
  expect(result.trace.tokens).toEqual(expect.any(Array));
  expect(result.trace.limit).toBe(engine.getState().limit);
  expect(Number.isFinite(result.trace.randomStateBefore)).toBe(true);
  expect(Number.isFinite(result.trace.randomStateAfter)).toBe(true);

  if (result.trace.selectedDecomposition !== null) {
    expect(
      result.trace.decompositions.some(
        (attempt) =>
          attempt.decompositionId === result.trace.selectedDecomposition && attempt.matched,
      ),
    ).toBe(true);
  }
}

describe('conversazioni italiane', () => {
  it.each(conversationInputs)('risponde con trace coerente a %s', (input) => {
    expectUsableResult(input);
  });

  it('dà precedenza alla keyword tristezza rispetto ai trigger generici', () => {
    const engine = createItalianEngine({ mode: 'deterministic', seed: 11 });
    const result = engine.respond('Io sono triste.');

    expect(result.trace.keywords[0]?.keywordId).toBe('it-tristezza');
    expect(result.trace.selectedKeyword).toBe('it-tristezza');
  });

  it.each([
    ['Mio padre pensa che io sia pigro.', 'pigra'],
    ['Mio padre pensa che io sia pigra.', 'pigro'],
    ['Vorrei essere più tranquillo.', 'tranquilla'],
    ['Vorrei essere più tranquilla.', 'tranquillo'],
  ])('non inverte il genere per: %s', (input, oppositeForm) => {
    const engine = createItalianEngine({ mode: 'deterministic', seed: 11 });
    const result = engine.respond(input);

    expect(result.response).not.toMatch(new RegExp(`\\b${oppositeForm}\\b`, 'iu'));
  });

  it('riproduce le conversazioni con lo stesso seed in modalità varied', () => {
    const inputs = [
      'Io sono triste.',
      'Ho paura di fallire.',
      'Mia madre non mi ascolta.',
      'Boh.',
      'Vorrei essere più tranquilla.',
    ];
    const first = createItalianEngine({ mode: 'varied', seed: 415 });
    const second = createItalianEngine({ mode: 'varied', seed: 415 });
    const firstResults = inputs.map((input) => first.respond(input));
    const secondResults = inputs.map((input) => second.respond(input));

    expect(firstResults.map(({ response }) => response)).toEqual(
      secondResults.map(({ response }) => response),
    );
    expect(firstResults.map(({ trace }) => trace.randomDraws)).toEqual(
      secondResults.map(({ trace }) => trace.randomDraws),
    );
  });
});
