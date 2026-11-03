import { describe, expect, it } from 'vitest';
import { createItalianEngine } from '../../src/language/it/index';

describe('risposte alla ripetizione', () => {
  it.each(['deterministic', 'varied'] as const)(
    'riporta letteralmente il testo ripetuto in modalità %s',
    (mode) => {
      const engine = createItalianEngine({ mode, seed: 1966 });
      const input = 'Vorrei parlare di $& e di mia madre.';

      engine.respond(input);
      const repeated = engine.respond(input);

      expect(repeated.trace.fallback).toBe('repetition');
      expect(repeated.trace.repeated).toBe(true);
      expect(repeated.response).toContain(`«${input}»`);
      expect(repeated.response).not.toContain('{{input}}');
    },
  );

  it('mantiene la modalità storica senza risposta speciale alla ripetizione', () => {
    const engine = createItalianEngine({ mode: 'historical' });

    engine.respond('Mia madre non mi ascolta.');
    const repeated = engine.respond('Mia madre non mi ascolta.');

    expect(repeated.trace.repeated).toBe(true);
    expect(repeated.trace.fallback).not.toBe('repetition');
    expect(repeated.response).not.toContain('{{input}}');
  });
});
