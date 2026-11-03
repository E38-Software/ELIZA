import { describe, expect, it } from 'vitest';
import { createItalianEngine } from '../../src/language/it/index';

describe('regressioni nelle conversazioni italiane', () => {
  it('completa il redirect da “genitori” al tema famiglia', () => {
    const engine = createItalianEngine({ mode: 'deterministic', seed: 1 });
    const result = engine.respond('I miei genitori');

    expect(result.trace.redirectChain).toContain('it-famiglia');
    expect(result.trace.decompositions).toContainEqual(
      expect.objectContaining({ keywordId: 'it-famiglia', matched: true }),
    );
    expect(result.trace.fallback).not.toBe('no-match');
    expect(result.response).toBe('Che cosa succede nella tua famiglia?');
  });

  it('mantiene la punteggiatura originale senza aggiungere un secondo punto nel repeat', () => {
    const engine = createItalianEngine({ mode: 'deterministic', seed: 1 });
    const input = 'Ho paura.';
    engine.respond(input);
    const replies = Array.from({ length: 4 }, () => engine.respond(input).response);

    expect(replies).toEqual([
      'Hai scritto: «Ho paura.» — che cosa vuoi aggiungere?',
      'Riprendo le parole «Ho paura.» — quale aspetto ti interessa?',
      'Hai già detto «Ho paura.» — cosa ti fa pensare a questo?',
      'Resto sulle tue parole: «Ho paura.» — vuoi continuare?',
    ]);
  });

  it('non inventa un punto quando l’input ripetuto ne è privo', () => {
    const engine = createItalianEngine({ mode: 'deterministic', seed: 1 });
    engine.respond('Ho paura');

    expect(engine.respond('Ho paura').response).toBe(
      'Hai scritto: «Ho paura» — che cosa vuoi aggiungere?',
    );
  });
});
