import { describe, expect, it } from 'vitest';
import { createItalianEngine, italianScript } from '../../src/language/it';
import { decisionSteps, decisionTree, treeGlossary } from '../../src/ui/trace';
import type { DecisionNode, ExplanationLevel } from '../../src/ui/trace';
import type { TraceRecord } from '../../src/core/types';

function walk(node: DecisionNode): DecisionNode[] {
  return [node, ...node.children.flatMap(walk)];
}

function path(node: DecisionNode): DecisionNode[] {
  const next = node.children.find((child) => child.state === 'selected');
  return next ? [node, ...path(next)] : [node];
}

const levels: readonly ExplanationLevel[] = ['beginner', 'intermediate', 'expert'];

describe('decisionTree', () => {
  it('parte dal messaggio, mostra tutte le parole chiave e illumina un solo percorso', () => {
    const { trace } = createItalianEngine().respond('Mia madre mi ascolta');
    const root = decisionTree(trace, italianScript);
    expect(root.kind).toBe('input');
    expect(root.children.map((child) => child.label)).toEqual(
      trace.keywords.map((candidate) => `«${candidate.trigger}»`),
    );
    expect(root.children.filter((child) => child.state === 'selected')).toHaveLength(1);
    expect(root.children.some((child) => child.state === 'unvisited')).toBe(true);
    expect(path(root).map((node) => node.kind)).toEqual([
      'input',
      'keyword',
      'pattern',
      'reply',
      'response',
    ]);
    expect(path(root).at(-1)?.label).toBe(`«${trace.response}»`);
  });

  it('registra solo i pattern davvero provati e distingue quelli scartati', () => {
    const { trace } = createItalianEngine().respond('Mi sento');
    const nodes = walk(decisionTree(trace, italianScript));
    const patterns = nodes.filter((node) => node.kind === 'pattern');
    expect(patterns).toHaveLength(trace.decompositions.length);
    expect(patterns.filter((node) => node.state === 'rejected')).toHaveLength(
      trace.decompositions.filter((attempt) => !attempt.matched).length,
    );
    const steps = path(decisionTree(trace, italianScript)).map((node) => node.kind);
    expect(steps).toEqual(['input', 'keyword', 'route', 'reply', 'response']);
  });

  it('mostra le alternative di ricomposizione accanto a quella usata', () => {
    const { trace } = createItalianEngine().respond('Mia madre mi ascolta');
    const replies = walk(decisionTree(trace, italianScript)).filter(
      (node) => node.kind === 'reply',
    );
    const rule = italianScript.keywords
      .flatMap((keyword) => keyword.decompositions)
      .find((candidate) => candidate.id === trace.selectedDecomposition);
    expect(replies).toHaveLength(rule?.reassemblies.length ?? 0);
    expect(replies.filter((node) => node.state === 'selected')).toHaveLength(1);
    expect(replies.some((node) => node.state === 'alternative')).toBe(true);
  });

  it('segue i redirect sotto la ricomposizione che li ha prodotti', () => {
    const { trace } = createItalianEngine().respond('I miei genitori');
    expect(trace.redirectChain).toEqual(['it-famiglia']);
    const root = decisionTree(trace, italianScript, 'expert');
    const route = path(root);
    expect(route.map((node) => node.kind)).toEqual([
      'input',
      'keyword',
      'pattern',
      'reply',
      'keyword',
      'pattern',
      'reply',
      'response',
    ]);
    expect(route[3]?.label).toBe('redirect → it-famiglia');
    expect(route[4]?.note).toContain('messa in testa allo stack da un redirect');
    expect(route[4]?.step).toBe(4);
    const famigliaCandidate = root.children.find((child) => child.note.startsWith('it-famiglia'));
    expect(famigliaCandidate?.state).toBe('unvisited');
  });

  it('spiega memoria FIFO, ripetizioni e assenza di parole chiave senza inventare tentativi', () => {
    const engine = createItalianEngine();
    const created = decisionTree(engine.respond('La mia bicicletta è rossa.').trace, italianScript);
    const memory = walk(created).find((node) => node.kind === 'memory');
    expect(memory?.state).toBe('matched');
    expect(memory?.step).toBe(3);
    engine.respond('xyzzy');
    const recalled = decisionTree(engine.respond('blorb').trace, italianScript);
    expect(path(recalled).map((node) => node.kind)).toEqual([
      'input',
      'route',
      'memory',
      'response',
    ]);

    const fallback = decisionTree(engine.respond('xyzzy').trace, italianScript);
    expect(fallback.children).toHaveLength(1);
    expect(fallback.children[0]?.label).toBe('Nessuna parola chiave riconosciuta');
    expect(walk(fallback).some((node) => node.kind === 'pattern')).toBe(false);

    const deterministic = createItalianEngine({ mode: 'deterministic' });
    deterministic.respond('Mi sento triste');
    const repetition = decisionTree(deterministic.respond('Mi sento triste').trace, italianScript);
    expect(repetition.children[0]?.label).toBe('Messaggio ripetuto');
    expect(repetition.children[0]?.state).toBe('selected');
    const skipped = repetition.children.filter((child) => child.kind === 'keyword');
    expect(skipped.length).toBeGreaterThan(0);
    expect(skipped.every((child) => child.state === 'unvisited')).toBe(true);
  });

  it('rivela ogni nodo non prima del suo genitore', () => {
    const { trace } = createItalianEngine().respond('I miei genitori');
    const check = (node: DecisionNode): void =>
      node.children.forEach((child) => {
        expect(child.step).toBeGreaterThanOrEqual(node.step);
        check(child);
      });
    check(decisionTree(trace, italianScript));
  });

  it('adatta etichette e note al livello senza cambiare la struttura', () => {
    const { trace } = createItalianEngine().respond('Mia madre mi ascolta');
    const [beginner, intermediate, expert] = levels.map((level) =>
      walk(decisionTree(trace, italianScript, level)),
    );
    expect(beginner?.map((node) => node.state)).toEqual(expert?.map((node) => node.state));
    expect(beginner?.map((node) => node.note).join(' ')).not.toContain('it-');
    expect(intermediate?.map((node) => node.note).join(' ')).toContain('precedenza');
    expect(expert?.map((node) => node.note).join(' ')).toContain('it-famiglia');
    expect(expert?.map((node) => node.label).join(' ')).toContain('it-famiglia-d1:');
  });
});

describe('decisionSteps', () => {
  it('produce sei passaggi con la risposta reale come ultimo dettaglio', () => {
    const { trace } = createItalianEngine().respond('Mia madre mi ascolta');
    for (const level of levels) {
      const steps = decisionSteps(trace, italianScript, level);
      expect(steps.map((step) => step.label)).toEqual([
        'Testo',
        'Parole chiave',
        'Schemi',
        'Memoria',
        'Scelta',
        'Risposta',
      ]);
      expect(steps[5]?.detail).toBe(trace.response);
    }
    const steps = decisionSteps(trace, italianScript);
    for (const [index, attempt] of trace.decompositions.entries()) {
      expect(steps[2]?.technical[index]).toContain(attempt.decompositionId);
      expect(steps[2]?.technical[index]).toContain('pattern:');
    }
    expect(steps[4]?.technical.join(' ')).toContain(trace.reassemblyId);
  });

  it('usa un linguaggio diverso per ogni livello', () => {
    const { trace } = createItalianEngine().respond('Mi sento triste');
    const [beginner, intermediate, expert] = levels.map((level) =>
      decisionSteps(trace, italianScript, level),
    );
    expect(beginner?.[2]?.explanation).toContain('gioco a incastro');
    expect(intermediate?.[2]?.explanation).toContain('spazi da riempire');
    expect(expert?.[2]?.explanation).toContain('wildcard');
    expect(beginner?.[5]?.explanation).toContain('LLM');
    expect(expert?.[1]?.explanation).toContain('unshift');
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
    expect(created?.chips).toEqual(['mia → tua']);
    const recalled = decisionSteps(engine.respond('xyzzy').trace, italianScript);
    expect(recalled[3]?.comparison?.before).toBe('1 ricordo');
    expect(recalled[3]?.comparison?.after).toBe('Nessun ricordo');
    expect(recalled[3]?.detail).toContain('recuperato');
    expect(recalled[4]?.detail).toContain('da più tempo');
  });

  it('illustra il riempimento della frase con il risultato reale senza alterare la risposta', () => {
    const { trace } = createItalianEngine().respond('Mi sento triste');
    const step = decisionSteps(trace, italianScript)[4];
    expect(step?.comparison?.before).toBe('Da quanto tempo ti senti …?');
    expect(step?.comparison?.after).toBe(trace.response);
  });
});

describe('glossario', () => {
  // Elenco indipendente dal glossario: ogni termine tecnico mostrato deve avere una definizione.
  const jargon: readonly (readonly [RegExp, string])[] = [
    [/\bNFC\b/u, 'NFC'],
    [/Unicode/u, 'Unicode'],
    [/UTF-16/u, 'UTF-16'],
    [/it-IT/u, 'it-IT'],
    [/\btoken\b/iu, 'Token'],
    [/tokenizzator/iu, 'Tokenizzatore'],
    [/clausol/iu, 'Clausola'],
    [/\bstack\b/iu, 'Stack'],
    [/unshift|\bpush\b/u, 'unshift'],
    [/priorità|precedenza/iu, 'Priorità'],
    [/copione/iu, 'Copione'],
    [/\bit-[a-z]/u, 'Identificatori'],
    [/al carattere/u, 'Posizione'],
    [/decomposizion|pattern|\bschem/iu, 'decomposizione'],
    [/\bliteral\b/u, 'literal'],
    [/\boneOf\b|\(\w+ \|/u, 'oneOf'],
    [/wildcard|\[[\w-]+: /u, 'wildcard'],
    [/backtracking/iu, 'Backtracking'],
    [/cattur/iu, 'Cattura'],
    [/redirectTo/u, 'redirectTo'],
    [/\bredirect\b|NEWKEY/u, 'NEWKEY'],
    [/ricomposizion/iu, 'Ricomposizione'],
    [/rotazion/iu, 'Rotazione'],
    [/PRNG|Mulberry|\bseed\b/u, 'PRNG'],
    [/memoryPolicy/u, 'memoryPolicy'],
    [/MEMORY/u, 'MEMORY'],
    [/FIFO|enqueue|dequeue/u, 'FIFO'],
    [/LIMIT|\bmod\b/u, 'LIMIT'],
    [/Hollerith|\bhash\b/iu, 'Hollerith'],
    [/riflession|riflett/iu, 'Riflessione'],
    [/no-match|fallback|empty-input/u, 'fallback'],
    [/\bLLM\b/u, 'LLM'],
    [/probabilit/iu, 'probabilità'],
    [/\b64\b/u, '64'],
  ];
  const unquote = (text: string): string => {
    let current = text;
    for (let previous = ''; current !== previous;) {
      previous = current;
      current = current.replace(/«[^«»]*»/gu, '');
    }
    return current;
  };
  const missing = (texts: readonly string[], terms: readonly { term: string }[]): string[] => {
    const text = unquote(texts.join('\n'));
    return jargon
      .filter(([pattern]) => pattern.test(text))
      .map(([, name]) => name)
      .filter((name) =>
        terms.every((entry) => !entry.term.toLowerCase().includes(name.toLowerCase())),
      );
  };

  function scenarios(): TraceRecord[] {
    const historical = createItalianEngine();
    const deterministic = createItalianEngine({ mode: 'deterministic' });
    deterministic.respond('Mi sento triste');
    return [
      historical.respond('Mia madre mi ascolta').trace,
      historical.respond('I miei genitori').trace,
      historical.respond('La mia bicicletta è rossa').trace,
      historical.respond('xyzzy').trace,
      historical.respond('blorb').trace,
      historical.respond('Mi sento').trace,
      historical.respond('...').trace,
      deterministic.respond('Mi sento triste').trace,
      createItalianEngine({ mode: 'varied', seed: 42 }).respond('Ciao, la mia casa').trace,
    ];
  }

  it('definisce ogni termine tecnico dei passaggi, ai livelli intermedio ed esperto', () => {
    for (const record of scenarios()) {
      for (const level of ['intermediate', 'expert'] as const) {
        decisionSteps(record, italianScript, level).forEach((step, index, all) => {
          const texts = [
            step.title,
            index === all.length - 1 ? '' : step.detail,
            step.explanation,
            ...step.technical,
          ];
          expect(missing(texts, step.glossary), `${level} · ${step.title}`).toEqual([]);
        });
      }
    }
  });

  it('definisce ogni termine tecnico visibile nell’albero, passaggio per passaggio', () => {
    for (const record of scenarios()) {
      for (const level of ['intermediate', 'expert'] as const) {
        const root = decisionTree(record, italianScript, level);
        for (let step = 0; step < 6; step += 1) {
          const texts = walk(root)
            .filter((node) => node.step <= step)
            .flatMap((node) =>
              ['pattern', 'route', 'reply'].includes(node.kind)
                ? [node.note, node.label]
                : [node.note],
            );
          expect(missing(texts, treeGlossary(root, step)), `${level} · ${step}`).toEqual([]);
        }
      }
    }
  });

  it('spiega davvero i termini, non si limita a nominarli', () => {
    const { trace } = createItalianEngine().respond('Mi sento triste');
    const [text] = decisionSteps(trace, italianScript, 'expert');
    const nfc = text?.glossary.find((entry) => entry.term.startsWith('NFC'));
    expect(nfc?.definition).toContain('U+0300');
    expect(text?.detail).toContain('categorie Unicode');
    expect(text?.glossary.map((entry) => entry.term)).toEqual(
      expect.arrayContaining(['Token', 'Tokenizzatore', 'Clausola']),
    );
  });

  it('non mostra glossari al livello base, che evita il gergo', () => {
    const { trace } = createItalianEngine().respond('Mia madre mi ascolta');
    for (const step of decisionSteps(trace, italianScript, 'beginner')) {
      expect(step.glossary).toEqual([]);
    }
  });
});
