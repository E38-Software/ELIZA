import { describe, expect, it } from 'vitest';
import { createItalianEngine } from '../../src/language/it/index';

describe('grammatica delle risposte italiane', () => {
  it('forma correttamente la completiva con “vorresti che” nel tema del bisogno', () => {
    const engine = createItalianEngine({ mode: 'deterministic', seed: 1 });
    const inputs = [
      'Ho bisogno di cambiare vita.',
      'Ho bisogno di riposare.',
      'Ho bisogno di parlare.',
      'Ho bisogno di tempo.',
    ];
    const replies = inputs.map((input) => engine.respond(input).response);

    expect(replies[3]).toBe('Cosa vorresti che succedesse rispetto a questo?');
  });
});
