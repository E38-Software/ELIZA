import { describe, expect, it } from 'vitest';
import { createItalianEngine, italianScript } from '../../src/language/it';
import { decisionSteps } from '../../src/ui/trace';

describe('decisionSteps', () => {
  it('mostra i candidati, i pattern e solo i tentativi effettivamente registrati', () => {
    const { trace } = createItalianEngine().respond('Mia madre mi ascolta');
    const steps = decisionSteps(trace, italianScript);
    expect(steps).toHaveLength(6);
    expect(steps[1]?.branches).toHaveLength(trace.keywords.length);
    expect(steps[1]?.branches.some((branch) => branch.state === 'unvisited')).toBe(true);
    expect(steps[2]?.branches).toHaveLength(trace.decompositions.length);
    for (const [index, attempt] of trace.decompositions.entries()) {
      expect(steps[2]?.technical[index]).toContain(attempt.decompositionId);
      expect(steps[2]?.technical[index]).toContain('pattern:');
      expect(steps[2]?.branches[index]?.state).toBe(attempt.matched ? 'matched' : 'rejected');
    }
    const choices = steps[4]?.branches ?? [];
    expect(choices.some((branch) => branch.state === 'alternative')).toBe(true);
    expect(choices.some((branch) => branch.state === 'selected')).toBe(true);
    expect(steps[4]?.technical.join(' ')).toContain(trace.reassemblyId);
    expect(steps[5]?.detail).toBe(trace.response);
  });

  it('distingue i pattern esclusi da quelli verificati', () => {
    const { trace } = createItalianEngine().respond('Mi sento');
    expect(trace.decompositions.some((attempt) => !attempt.matched)).toBe(true);
    const branches = decisionSteps(trace, italianScript)[2]?.branches;
    expect(branches?.filter((branch) => branch.state === 'rejected')).toHaveLength(
      trace.decompositions.filter((attempt) => !attempt.matched).length,
    );
  });

  it('mostra le estrazioni variate con seed e numero reale di alternative', () => {
    const { trace } = createItalianEngine({ mode: 'varied', seed: 42 }).respond('Ciao');
    const selection = decisionSteps(trace, italianScript)[4];
    expect(selection?.detail).toContain('seed (42)');
    for (const draw of trace.randomDraws) {
      expect(
        selection?.technical.some((text) =>
          text.includes(`alternativa ${draw.index + 1} di ${draw.maxExclusive}`),
        ),
      ).toBe(true);
    }
  });

  it('spiega memoria FIFO, ripetizioni e assenza di parole chiave senza inventare tentativi', () => {
    const engine = createItalianEngine();
    engine.respond('La mia bicicletta è rossa.');
    engine.respond('xyzzy');
    const { trace: memory } = engine.respond('blorb');
    expect(memory.memory.recalled).not.toBeNull();
    expect(decisionSteps(memory, italianScript)[4]?.detail).toContain('da più tempo');

    const deterministic = createItalianEngine({ mode: 'deterministic' });
    deterministic.respond('Ciao');
    const { trace: repetition } = deterministic.respond('Ciao');
    expect(decisionSteps(repetition, italianScript)[2]?.branches).toEqual([
      expect.objectContaining({ state: 'unvisited', text: expect.stringContaining('ripetizione') }),
    ]);

    const { trace: fallback } = engine.respond('xyzzy');
    expect(decisionSteps(fallback, italianScript)[1]?.branches).toEqual([
      { state: 'rejected', text: 'Nessuna parola chiave riconosciuta' },
    ]);
  });

  it('mostra i redirect senza marcare come non visitata la prima chiave scelta', () => {
    const { trace } = createItalianEngine().respond('I miei genitori');
    const steps = decisionSteps(trace, italianScript);
    expect(
      steps[3]?.branches.some(
        (branch) => branch.text === 'La ricerca è passata al tema «famiglia».',
      ),
    ).toBe(true);
    const first = steps[1]?.branches.find((branch) => branch.text.includes('da qui parte'));
    expect(first?.state).toBe('matched');
  });

  it('spiega memoria vuota, creazione e richiamo con etichette prima/dopo invece di un punteggio', () => {
    const engine = createItalianEngine();
    const empty = decisionSteps(engine.respond('Mi sento triste').trace, italianScript)[3];
    expect(empty?.detail).toContain('Non è un punteggio');
    expect(empty?.comparison).toEqual({
      beforeLabel: 'Prima di questo messaggio',
      before: 'Nessun ricordo',
      afterLabel: 'Dopo questo messaggio',
      after: 'Nessun ricordo',
    });
    expect(empty?.explanation).toContain('non tutta la conversazione');
    const created = decisionSteps(
      engine.respond('La mia bicicletta è rossa').trace,
      italianScript,
    )[3];
    expect(created?.comparison?.before).toBe('Nessun ricordo');
    expect(created?.comparison?.after).toBe('1 ricordo');
    expect(created?.branches.some((branch) => branch.text.startsWith('Conservato'))).toBe(true);
    const recalled = decisionSteps(engine.respond('xyzzy').trace, italianScript)[3];
    expect(recalled?.comparison?.before).toBe('1 ricordo');
    expect(recalled?.comparison?.after).toBe('Nessun ricordo');
    expect(recalled?.branches.some((branch) => branch.text.startsWith('Ripreso'))).toBe(true);
  });

  it('illustra il riempimento della frase con il risultato reale senza alterare la risposta', () => {
    const { trace } = createItalianEngine().respond('Mi sento triste');
    const step = decisionSteps(trace, italianScript)[4];
    expect(step?.comparison?.before).toBe('Da quanto tempo ti senti …?');
    expect(step?.comparison?.after).toBe(trace.response);
  });
});
