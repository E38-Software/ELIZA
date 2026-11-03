import { describe, expect, it } from 'vitest';
import { createItalianEngine } from '../../src/language/it/index';

const inputs = [
  'La mia bicicletta è rossa.',
  'xyzzy',
  'blorb',
  'I miei genitori',
  'Ho paura.',
  'Ho paura.',
  'Ho paura!',
] as const;

const conversations = [
  {
    mode: 'historical',
    responses: [
      'Che cosa rappresenta per te questa cosa?',
      'Puoi raccontarmi qualcosa in più?',
      'Tengo presente «La mia bicicletta è rossa». Su quale parte vuoi soffermarti?',
      'Che cosa succede nella tua famiglia?',
      'Che cosa ti preoccupa di più?',
      'Quando hai cominciato a pensarci?',
      'Cosa succede quando questa paura si presenta?',
    ],
    randomIndices: [],
  },
  {
    mode: 'deterministic',
    responses: [
      'Che cosa rappresenta per te questa cosa?',
      'Puoi raccontarmi qualcosa in più?',
      'Tengo presente «La mia bicicletta è rossa». Su quale parte vuoi soffermarti?',
      'Che cosa succede nella tua famiglia?',
      'Che cosa ti preoccupa di più?',
      'Hai scritto: «Ho paura.» — che cosa vuoi aggiungere?',
      'Quando hai cominciato a pensarci?',
    ],
    randomIndices: [],
  },
  {
    mode: 'varied',
    responses: [
      'Che cosa ti fa venire in mente?',
      'Che cosa ti viene in mente adesso?',
      'Prima hai scritto: «La mia bicicletta è rossa». Che cosa conta di più per te in questa frase?',
      'Vuoi raccontarmi qualcosa di più su questo rapporto?',
      'Quando hai cominciato a pensarci?',
      'Riprendo le parole «Ho paura.» — quale aspetto ti interessa?',
      'Vuoi descrivere meglio ciò che temi?',
    ],
    randomIndices: [0, 2, 1, 2, 1, 1, 3],
  },
] as const;

describe('conversazioni golden multi-turno', () => {
  it.each(conversations)(
    'mantiene memoria, redirect e ripetizione in modalità $mode',
    ({ mode, responses, randomIndices }) => {
      const engine = createItalianEngine({ mode, seed: 415 });
      const results = inputs.map((input) => engine.respond(input));

      expect(results.map(({ response }) => response)).toEqual(responses);
      expect(results.map(({ trace }) => trace.limit)).toEqual([2, 3, 4, 1, 2, 3, 4]);
      expect(results[0]?.trace.memory.created).toBe(responses[2]);
      expect(results[1]?.trace.fallback).toBe('none');
      expect(results[2]?.trace.memory.recalled).toBe(responses[2]);
      expect(results[2]?.trace.memory.sizeAfter).toBe(0);
      expect(results[3]?.trace.selectedKeyword).toBe('it-genitori');
      expect(results[3]?.trace.redirectChain).toEqual(['it-famiglia']);
      expect(results[3]?.trace.selectedDecomposition).toBe('it-famiglia-d1');
      expect(results[5]?.trace.repeated).toBe(true);
      expect(results[5]?.trace.fallback).toBe(mode === 'historical' ? null : 'repetition');
      expect(results[6]?.trace.repeated).toBe(false);
      expect(results.flatMap(({ trace }) => trace.randomDraws.map(({ index }) => index))).toEqual(
        randomIndices,
      );
    },
  );
});
