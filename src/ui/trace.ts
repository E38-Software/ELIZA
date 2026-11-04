import type {
  DecompositionAttempt,
  ElizaScript,
  EngineMode,
  FallbackRule,
  PatternTerm,
  ReassemblyRule,
  ReflectionCategory,
  TokenKind,
  TraceRecord,
} from '../core/types';
import { glossaryFor } from './glossary';
import type { GlossaryEntry } from './glossary';

export type ExplanationLevel = 'beginner' | 'intermediate' | 'expert';

export type BranchState = 'selected' | 'matched' | 'rejected' | 'unvisited' | 'alternative';

export type DecisionNodeKind =
  'input' | 'keyword' | 'route' | 'pattern' | 'memory' | 'reply' | 'response';

export interface DecisionNode {
  readonly kind: DecisionNodeKind;
  /** `selected` marca i nodi del percorso che porta alla risposta. */
  readonly state: BranchState;
  /** Indice del passaggio che rivela il nodo. */
  readonly step: number;
  readonly label: string;
  readonly note: string;
  readonly children: readonly DecisionNode[];
}

export interface TraceStep {
  readonly title: string;
  readonly label: string;
  readonly detail: string;
  readonly explanation: string;
  readonly technical: readonly string[];
  /** Definizioni dei termini tecnici usati nel passaggio; vuoto per il livello base. */
  readonly glossary: readonly GlossaryEntry[];
  readonly chips?: readonly string[];
  readonly comparison?: {
    readonly beforeLabel: string;
    readonly before: string;
    readonly afterLabel: string;
    readonly after: string;
  };
}

type Say = (beginner: string, intermediate: string, expert: string) => string;

function speaker(level: ExplanationLevel): Say {
  return (beginner, intermediate, expert) =>
    level === 'beginner' ? beginner : level === 'expert' ? expert : intermediate;
}

const revealStep: Record<DecisionNodeKind, number> = {
  input: 0,
  keyword: 1,
  route: 1,
  pattern: 2,
  memory: 3,
  reply: 4,
  response: 5,
};

const modeNames: Record<EngineMode, string> = {
  historical: 'storica',
  deterministic: 'deterministica',
  varied: 'variata',
};

const tokenKindNames: Record<TokenKind, readonly [string, string]> = {
  word: ['parola', 'parole'],
  number: ['numero', 'numeri'],
  punctuation: ['segno di punteggiatura', 'segni di punteggiatura'],
  symbol: ['simbolo', 'simboli'],
  whitespace: ['spazio', 'spazi'],
};

const reflectionNames: Record<ReflectionCategory, string> = {
  pronoun: 'pronome',
  possessive: 'possessivo',
  verb: 'verbo',
  clitic: 'pronome atono',
  elision: 'elisione',
  exception: 'eccezione',
};

const fallbackDescriptions: Record<string, string> = {
  'empty-input': 'messaggio vuoto, frase fissa',
  repetition: 'messaggio ripetuto, frasi per le ripetizioni',
  none: 'nessuna parola chiave utilizzabile, risposta generica',
  'no-match': 'nessuno schema compatibile, risposta generica no-match',
  'safe-language': 'riflessione non sicura, frase prudente di riserva',
};

const readableName = (id: string): string => id.replace(/^it-/u, '').replace(/-/gu, ' ');
const quoted = (text: string): string => `«${text}»`;
const withGaps = (template: string): string => template.replace(/\{\{[^}]+\}\}/gu, '…');
const fragments = (captures: Readonly<Record<string, string>>): string[] =>
  Object.values(captures).filter(Boolean);
const quotedList = (items: readonly string[]): string => items.map(quoted).join(', ');
const counted = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;
const listed = (items: readonly string[]): string =>
  items.length > 1
    ? `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`
    : items.join('');
const describeCaptures = (captures: Readonly<Record<string, string>>): string =>
  Object.entries(captures)
    .map(([name, value]) => `${name} = ${quoted(value)}`)
    .join(', ');

function describePattern(pattern: readonly PatternTerm[]): string {
  return pattern
    .map((term) => {
      switch (term.kind) {
        case 'literal':
          return term.value;
        case 'oneOf':
          return `(${term.values.join(' | ')})`;
        case 'wildcard':
          return `[${term.capture}: ${term.min ?? 0}–${term.max ?? '∞'} parole]`;
        case 'count':
          return `[${term.capture}: ${term.count} parole]`;
      }
    })
    .join(' ');
}

function readablePattern(pattern: readonly PatternTerm[], shown: number): string {
  return pattern
    .map((term) => {
      switch (term.kind) {
        case 'literal':
          return term.value;
        case 'oneOf':
          return `(${term.values.slice(0, shown).join(' / ')}${term.values.length > shown ? ' / …' : ''})`;
        case 'wildcard':
        case 'count':
          return '___';
      }
    })
    .join(' ');
}

interface DraftNode {
  readonly kind: DecisionNodeKind;
  outcome: BranchState;
  readonly step: number;
  readonly label: string;
  note: string;
  readonly children: DraftNode[];
}

function finalize(draft: DraftNode, parentStep: number): { node: DecisionNode; onPath: boolean } {
  const step = Math.max(draft.step, parentStep);
  const children = draft.children.map((child) => finalize(child, step));
  const onPath = draft.kind === 'response' || children.some((child) => child.onPath);
  return {
    node: {
      kind: draft.kind,
      state: onPath ? 'selected' : draft.outcome,
      step,
      label: draft.label,
      note: draft.note,
      children: children.map((child) => child.node),
    },
    onPath,
  };
}

/**
 * Ricostruisce dalla traccia l'albero delle possibilità: ogni ramo è una parola chiave,
 * uno schema o una risposta che il copione offriva, con l'esito registrato dal motore.
 */
export function decisionTree(
  record: TraceRecord,
  script: ElizaScript,
  level: ExplanationLevel = 'intermediate',
): DecisionNode {
  const say = speaker(level);
  const rules = new Map(script.keywords.map((rule) => [rule.id, rule]));
  const varied = record.selectionMode === 'varied';
  const draft = (
    kind: DecisionNodeKind,
    outcome: BranchState,
    label: string,
    note: string,
    step = revealStep[kind],
  ): DraftNode => ({ kind, outcome, step, label, note, children: [] });
  const adopt = (parent: DraftNode, ...children: DraftNode[]): DraftNode => {
    parent.children.push(...children);
    return parent;
  };

  const response = (): DraftNode =>
    draft(
      'response',
      'selected',
      quoted(record.response),
      say(
        'È la frase che hai letto nella chat.',
        record.fallback === 'safe-language'
          ? 'Risposta finale, con una frase prudente di riserva.'
          : 'Risposta finale mostrata nella chat.',
        `output del motore${
          record.fallback
            ? ` · percorso di riserva: ${fallbackDescriptions[record.fallback] ?? record.fallback}`
            : ''
        }`,
      ),
    );

  const choiceNote = (chosen: boolean, index: number, count: number, id: string): string => {
    if (!chosen) {
      return say('Pronta per un’altra volta.', 'Alternativa non scelta ora.', `${id} · non scelta`);
    }
    if (count === 1) {
      return say(
        'È l’unica possibilità prevista qui.',
        'Unica possibilità prevista.',
        `${id} · unica ricomposizione dello schema`,
      );
    }
    return varied
      ? say(
          'Pescata a sorte fra quelle pronte.',
          `Estratta a caso: ${index + 1} di ${count}.`,
          `${id} · estratta dal PRNG: alternativa ${index + 1} di ${count}`,
        )
      : say(
          'Tocca a lei: le frasi si usano a turno.',
          `Usata a turno: ${index + 1} di ${count}.`,
          `${id} · rotazione: indice ${index}, cioè risposta n. ${index + 1} di ${count}`,
        );
  };

  const fallbackChoices = (rule: FallbackRule): DraftNode[] => {
    const prefix = `${rule.id}:`;
    const chosen = record.reassemblyId?.startsWith(prefix)
      ? Number(record.reassemblyId.slice(prefix.length))
      : -1;
    const byCounter = rule === script.noMatch && !varied;
    return rule.replies.map((reply, index) => {
      const selected = index === chosen;
      const id = `${rule.id}:${index}`;
      const note =
        selected && byCounter
          ? say(
              'Scelta da un contatore che avanza a ogni messaggio.',
              `Scelta dal contatore dei turni: ${index + 1} di ${rule.replies.length}.`,
              `${id} · (LIMIT − 1) mod ${rule.replies.length} = ${index}, con LIMIT = ${record.limit}`,
            )
          : choiceNote(selected, index, rule.replies.length, id);
      const node = draft(
        'reply',
        selected ? 'matched' : 'alternative',
        quoted(withGaps(reply)),
        note,
      );
      return selected ? adopt(node, response()) : node;
    });
  };

  const noMatchRoute = (): DraftNode =>
    adopt(
      draft(
        'route',
        'matched',
        say(
          'Nessun modello combacia',
          'Nessuno schema corrisponde',
          'Nessuno schema corrisponde (no-match)',
        ),
        say(
          'ELIZA ripiega su una frase generica.',
          'Si usa una risposta generica del copione.',
          `risposta generica scelta fra le frasi di ${script.noMatch.id}`,
        ),
        revealStep.pattern,
      ),
      ...fallbackChoices(script.noMatch),
    );

  const reassemblyLabel = (reassembly: ReassemblyRule): string => {
    switch (reassembly.kind) {
      case 'reply':
        return quoted(withGaps(reassembly.template));
      case 'redirect':
        return say(
          `Passa all’argomento ${quoted(readableName(reassembly.target))}`,
          `Rinvia al tema ${quoted(readableName(reassembly.target))}`,
          `redirect → ${reassembly.target}`,
        );
      case 'newkey':
        return say(
          'Lascia perdere e prova la parola successiva',
          'Passa alla parola chiave successiva',
          'NEWKEY: passa alla voce successiva dello stack',
        );
    }
  };

  const root = draft(
    'input',
    'selected',
    quoted(record.originalInput.trim()),
    say(
      'Il tuo messaggio: da qui partono tutte le strade possibili.',
      record.activeClause
        ? `Messaggio di partenza · parte analizzata: ${quoted(record.activeClause)}`
        : 'Messaggio di partenza',
      `${counted(record.tokens.length, 'token', 'token')} · ${
        record.keywords.length
          ? `clausola analizzata: ${quoted(record.activeClause)}`
          : 'nessuna clausola contiene parole chiave'
      }`,
    ),
  );

  if (record.fallback === 'empty-input') {
    adopt(
      root,
      adopt(
        draft(
          'route',
          'matched',
          say(
            'Non ci sono parole da cercare',
            'Messaggio senza parole',
            'Messaggio vuoto (empty-input)',
          ),
          say(
            'ELIZA risponde con una frase fissa.',
            'Si usa la risposta fissa per i messaggi vuoti.',
            'nessuna parola, numero o simbolo: si usa la frase fissa per i messaggi vuoti',
          ),
        ),
        response(),
      ),
    );
    return finalize(root, 0).node;
  }

  if (record.fallback === 'repetition') {
    adopt(
      root,
      adopt(
        draft(
          'route',
          'matched',
          say('Hai riscritto la stessa frase', 'Messaggio ripetuto', 'Messaggio ripetuto (repeat)'),
          say(
            'ELIZA se ne accorge e usa le frasi pensate per le ripetizioni.',
            'Uguale al precedente: le parole chiave non vengono provate.',
            `identico al precedente dopo la normalizzazione · modalità ${modeNames[record.selectionMode]}: lo stack non viene usato`,
          ),
        ),
        ...fallbackChoices(script.repeat),
      ),
    );
  } else if (record.keywords.length === 0) {
    const recalled = record.memory.recalled;
    const route = draft(
      'route',
      'matched',
      say(
        'Nessuna parola conosciuta',
        'Nessuna parola chiave riconosciuta',
        'Stack vuoto: nessuna parola chiave',
      ),
      recalled
        ? say(
            'ELIZA sfoglia il suo taccuino e riprende una tua frase di prima.',
            'Senza parole chiave, ELIZA può recuperare un ricordo.',
            'LIMIT = 4 e coda dei ricordi non vuota: si riprende un ricordo',
          )
        : say(
            'ELIZA usa una frase di riserva, buona per ogni occasione.',
            'Senza parole chiave, si usa una risposta generica.',
            `LIMIT = ${record.limit}${
              record.limit === 4
                ? ' ma coda dei ricordi vuota'
                : ' (i ricordi si riprendono solo con LIMIT = 4)'
            }: risposta generica ${script.fallback.id}`,
          ),
    );
    if (recalled) {
      adopt(
        route,
        adopt(
          draft(
            'memory',
            'matched',
            quoted(recalled),
            say(
              'Ripresa dal taccuino: è l’appunto più vecchio.',
              'Ricordo recuperato: il più vecchio della coda.',
              `estratto dalla testa della coda FIFO: è il ricordo più vecchio (regola ${quoted(record.memory.ruleId ?? '?')})`,
            ),
          ),
          response(),
        ),
      );
    } else {
      adopt(route, ...fallbackChoices(script.fallback));
    }
    adopt(root, route);
  }

  const candidates = record.keywords.map((candidate) =>
    draft('keyword', 'unvisited', quoted(candidate.trigger), ''),
  );
  adopt(root, ...candidates);

  const visits: { keywordId: string; attempts: DecompositionAttempt[] }[] = [];
  for (const attempt of record.decompositions) {
    const last = visits[visits.length - 1];
    const restart = rules.get(attempt.keywordId)?.decompositions[0]?.id === attempt.decompositionId;
    if (last && last.keywordId === attempt.keywordId && !restart) last.attempts.push(attempt);
    else visits.push({ keywordId: attempt.keywordId, attempts: [attempt] });
  }
  if (visits.length === 0 && record.selectedKeyword && record.fallback !== 'repetition') {
    visits.push({ keywordId: record.selectedKeyword, attempts: [] });
  }

  const tried = new Set<number>();
  let createdMemories = 0;
  let redirects = 0;
  let attachTo: DraftNode | null = null;

  visits.forEach((visit, index) => {
    const rule = rules.get(visit.keywordId);
    const next = visits[index + 1];
    const final = index === visits.length - 1;
    const position = attachTo
      ? -1
      : record.keywords.findIndex(
          (candidate, place) => candidate.keywordId === visit.keywordId && !tried.has(place),
        );
    let keywordNode = candidates[position];
    if (keywordNode) {
      tried.add(position);
      keywordNode.outcome = 'matched';
    } else {
      keywordNode = draft(
        'keyword',
        'matched',
        quoted(readableName(visit.keywordId)),
        say(
          'Argomento raggiunto con un rinvio.',
          'Tema raggiunto tramite rinvio.',
          `${visit.keywordId} · priorità ${rule?.priority ?? '?'} · messa in testa allo stack da un redirect`,
        ),
      );
      adopt(attachTo ?? root, keywordNode);
    }
    attachTo = null;

    if (rule?.memoryPolicy) {
      const text = record.memory.createdEntries[createdMemories];
      if (text !== undefined) {
        createdMemories += 1;
        adopt(
          keywordNode,
          draft(
            'memory',
            'matched',
            quoted(text),
            say(
              'Annotata nel taccuino, per riprenderla più avanti.',
              'Ricordo conservato per un turno futuro.',
              `template MEMORY ${quoted(record.memory.ruleId ?? '?')} n. ${
                (record.memory.selectionIndex ?? 0) + 1
              } di 4 · scelto con ${
                record.memory.selectionMethod === 'seeded' ? 'il PRNG' : 'l’hash Hollerith'
              } · accodato nella coda FIFO`,
            ),
          ),
        );
      }
    }

    let matched: { node: DraftNode; attempt: DecompositionAttempt } | null = null;
    for (const attempt of visit.attempts) {
      const pattern =
        rule?.decompositions.find((candidate) => candidate.id === attempt.decompositionId)
          ?.pattern ?? [];
      const found = fragments(attempt.captures);
      const open =
        pattern.length > 0 &&
        pattern.every((term) => term.kind === 'wildcard' || term.kind === 'count');
      const node = draft(
        'pattern',
        attempt.matched ? 'matched' : 'rejected',
        say(
          open
            ? 'Modello libero: va bene qualunque frase'
            : `Modello ${quoted(readablePattern(pattern, 3))}`,
          `Schema ${quoted(readablePattern(pattern, 6))}${open ? ' (qualsiasi frase)' : ''}`,
          `${attempt.decompositionId}: ${pattern.length ? describePattern(pattern) : 'non disponibile nel copione'}`,
        ),
        attempt.matched
          ? say(
              found.length ? `Combacia! Parole ritagliate: ${quotedList(found)}.` : 'Combacia!',
              found.length
                ? `Corrisponde · frammenti catturati: ${quotedList(found)}`
                : 'Corrisponde',
              `corrisponde · ${
                Object.keys(attempt.captures).length
                  ? `catture: ${describeCaptures(attempt.captures)}`
                  : 'nessuna cattura'
              }`,
            )
          : say(
              'Non combacia: questo modello viene scartato.',
              'Non corrisponde: schema scartato.',
              'non corrisponde: nessun modo di coprire tutta la clausola',
            ),
      );
      adopt(keywordNode, node);
      if (attempt.matched) matched = { node, attempt };
    }

    const redirectTarget =
      next && record.redirectChain[redirects] === next.keywordId ? next.keywordId : null;
    if (matched) {
      const { node: patternNode, attempt } = matched;
      const decompositionId = attempt.decompositionId;
      const reassemblies =
        rule?.decompositions.find((candidate) => candidate.id === decompositionId)?.reassemblies ??
        [];
      const chosenId = final
        ? record.reassemblyId
        : reassemblies.find((reassembly) =>
            redirectTarget
              ? reassembly.kind === 'redirect' && reassembly.target === redirectTarget
              : reassembly.kind === 'newkey',
          )?.id;
      if (redirectTarget) redirects += 1;
      reassemblies.forEach((reassembly, place) => {
        const chosen = reassembly.id === chosenId;
        const node = draft(
          'reply',
          chosen ? 'matched' : 'alternative',
          reassemblyLabel(reassembly),
          choiceNote(chosen, place, reassemblies.length, reassembly.id),
        );
        adopt(patternNode, node);
        if (!chosen) return;
        if (reassembly.kind === 'redirect') attachTo = node;
        else if (reassembly.kind === 'reply' && final && record.fallback !== 'no-match') {
          adopt(node, response());
        }
      });
      if (final && record.fallback === 'no-match') adopt(patternNode, noMatchRoute());
    } else if (redirectTarget && rule?.redirectTo === redirectTarget) {
      redirects += 1;
      attachTo = draft(
        'route',
        'matched',
        say(
          `Nessun modello combacia: passa all’argomento ${quoted(readableName(redirectTarget))}`,
          `Nessuno schema corrisponde: rinvio a ${quoted(readableName(redirectTarget))}`,
          `redirectTo → ${redirectTarget}`,
        ),
        say(
          'Le regole prevedono di continuare con un argomento vicino.',
          'Il copione prevede un tema di riserva per questa parola chiave.',
          'nessuno schema corrisponde: si prosegue con il tema di riserva dichiarato dalla parola chiave',
        ),
        revealStep.pattern,
      );
      adopt(keywordNode, attachTo);
    } else if (final && record.fallback === 'no-match') {
      adopt(keywordNode, noMatchRoute());
    }
  });

  if (record.fallback === 'none' && visits.length > 0) {
    const limitReached = record.exceptions.includes('Limite dei redirect raggiunto.');
    adopt(
      root,
      adopt(
        draft(
          'route',
          'matched',
          say(
            'Nessun’altra parola da provare',
            'Parole chiave esaurite',
            limitReached ? 'Limite di 64 trasformazioni raggiunto' : 'Stack esaurito',
          ),
          say(
            'ELIZA usa una frase di riserva, buona per ogni occasione.',
            'Si usa una risposta generica.',
            `nessuna voce dello stack ha prodotto una risposta: risposta generica ${script.fallback.id}`,
          ),
        ),
        ...fallbackChoices(script.fallback),
      ),
    );
  }

  const firstTried = Math.min(...tried);
  record.keywords.forEach((candidate, position) => {
    const node = candidates[position];
    if (!node) return;
    const used = tried.has(position);
    const first = position === firstTried;
    const topic = readableName(candidate.keywordId);
    node.note = say(
      used
        ? first
          ? `Parola conosciuta (argomento: ${topic}). ELIZA parte da qui perché è la più importante.`
          : `Parola conosciuta (argomento: ${topic}), provata in un secondo momento.`
        : record.fallback === 'repetition'
          ? 'Parola conosciuta, ma con le ripetizioni ELIZA non la usa.'
          : 'Parola conosciuta, ma non serve: ELIZA si ferma alla prima regola che funziona.',
      `Parola chiave del tema ${quoted(topic)} · precedenza ${candidate.priority}${
        used ? (first ? ' · provata per prima' : ' · provata dopo') : ' · non provata'
      }`,
      `${candidate.keywordId} · priorità ${candidate.priority} · al carattere ${candidate.position}${
        used
          ? first
            ? ' · prima voce estratta dallo stack'
            : ' · estratta dallo stack in seguito'
          : record.fallback === 'repetition'
            ? ' · stack ignorato per la ripetizione'
            : ' · mai estratta dallo stack'
      }`,
    );
  });

  return finalize(root, 0).node;
}

/** Glossario dei termini che compaiono nei nodi dell'albero visibili fino al passaggio indicato. */
export function treeGlossary(root: DecisionNode, step: number): readonly GlossaryEntry[] {
  const texts: string[] = [];
  const visit = (node: DecisionNode): void => {
    if (node.step > step) return;
    texts.push(node.note);
    // Le altre etichette riportano parole dell'utente, non termini tecnici.
    if (node.kind === 'pattern' || node.kind === 'route' || node.kind === 'reply') {
      texts.push(node.label);
    }
    node.children.forEach(visit);
  };
  visit(root);
  return glossaryFor(texts);
}

export function decisionSteps(
  record: TraceRecord,
  script: ElizaScript,
  level: ExplanationLevel = 'intermediate',
): readonly TraceStep[] {
  const say = speaker(level);
  const mode = modeNames[record.selectionMode];
  const selectedRule = script.keywords
    .flatMap((keyword) => keyword.decompositions)
    .find(
      (rule) =>
        rule.id === record.selectedDecomposition &&
        rule.reassemblies.some((choice) => choice.id === record.reassemblyId),
    );
  const chosenReply = selectedRule?.reassemblies.find((rule) => rule.id === record.reassemblyId);
  const firstKeyword = record.keywords.find(
    (candidate) => candidate.keywordId === record.selectedKeyword,
  );
  const words = record.tokens.filter((token) => token.kind !== 'whitespace');
  const tokenSummary = listed(
    (Object.keys(tokenKindNames) as TokenKind[]).flatMap((kind) => {
      const count = record.tokens.filter((token) => token.kind === kind).length;
      const [one, many] = tokenKindNames[kind];
      return count ? [counted(count, one, many)] : [];
    }),
  );
  const matchedCount = record.decompositions.filter((attempt) => attempt.matched).length;
  const rejectedCount = record.decompositions.length - matchedCount;
  const noMatchCount = script.noMatch.replies.length;
  const noMatchIndex = (record.limit - 1) % noMatchCount;
  const reflectionList = record.reflections
    .map((change) => `${quoted(change.original)} → ${quoted(change.replacement)}`)
    .join(', ');
  const memoryCreated = record.memory.createdEntries.length > 0;

  const method = record.memory.recalled
    ? say(
        'Invece di scegliere una frase nuova, ELIZA usa quella ripresa dal taccuino.',
        'ELIZA riprende il ricordo conservato da più tempo, invece di scegliere una nuova frase.',
        'La risposta è il ricordo estratto dalla coda, preso da più tempo: in questo turno non viene scelta nessuna ricomposizione.',
      )
    : record.fallback === 'empty-input'
      ? say(
          'Non avendo parole da usare, ELIZA risponde con una frase fissa che ti invita a scrivere.',
          'Non ci sono parole da usare: ELIZA restituisce una frase fissa per chiederti di scrivere.',
          'Il messaggio non contiene parole, numeri o simboli: si usa la frase fissa del copione per i messaggi vuoti, senza alcuna scelta.',
        )
      : record.fallback === 'no-match' && record.selectionMode !== 'varied'
        ? say(
            'Nessun modello ha funzionato: ELIZA usa una delle sue frasi generiche, scelta da un contatore che avanza a ogni messaggio.',
            'Nessuno schema ha prodotto una risposta. Un contatore che si ripete sceglie una delle frasi generiche.',
            `Nessuno schema compatibile: la risposta generica no-match viene scelta dal contatore LIMIT con la formula (LIMIT − 1) mod ${noMatchCount}. Con LIMIT = ${record.limit} si ottiene l’indice ${noMatchIndex}, cioè la frase n. ${noMatchIndex + 1}.`,
          )
        : record.selectionMode === 'varied'
          ? say(
              `ELIZA pesca una frase a sorte, come da un mazzo di carte. Il numero di partenza (seed ${record.seed}) fa sì che lo stesso mazzo dia sempre la stessa sequenza.`,
              `Una scelta casuale guidata decide fra frasi già scritte. Il numero iniziale, chiamato seed (${record.seed}), permette di ripetere la stessa sequenza.`,
              record.randomDraws.length
                ? `Modalità variata: le scelte fra più alternative sono fatte dal PRNG Mulberry32, inizializzato con il seed ${record.seed}. In questo turno ${
                    record.randomDraws.length === 1
                      ? 'c’è stata 1 estrazione'
                      : `ci sono state ${record.randomDraws.length} estrazioni`
                  }; con lo stesso seed e gli stessi messaggi si ottengono le stesse scelte.`
                : `Modalità variata con seed ${record.seed}: in questo turno non è servita nessuna estrazione del PRNG, perché c’era una sola possibilità.`,
            )
          : say(
              'Le frasi pronte si usano a turno: la prima volta una, la volta dopo la successiva, poi si ricomincia. Nessuna frase viene inventata.',
              'Le frasi già scritte vengono usate a turno: la prima volta una, la volta successiva un’altra, poi si ricomincia. Non vengono inventate nuove risposte.',
              `Modalità ${mode}: ogni schema ha un indice di rotazione che parte da 0 e avanza di uno a ogni uso, ricominciando dopo l’ultima alternativa. ${
                record.rotationIndex === null
                  ? 'In questo turno non è stato usato nessun indice di rotazione.'
                  : `In questo turno è stato usato l’indice ${record.rotationIndex}, cioè la ricomposizione n. ${record.rotationIndex + 1}.`
              }`,
            );

  const memoryUnchanged = !memoryCreated && record.memory.recalled === null;
  const memoryEmpty = record.memory.sizeBefore === 0 && record.memory.sizeAfter === 0;
  const memoryDetail =
    (memoryUnchanged
      ? memoryEmpty
        ? say(
            'Il taccuino è vuoto: in questo scambio ELIZA non ha annotato né ripreso nulla.',
            'Nessun ricordo prima, nessun ricordo dopo. In questo scambio ELIZA non ha conservato né recuperato una frase. Non è un punteggio: la memoria è semplicemente vuota.',
            'La coda dei ricordi era vuota e resta vuota (0 → 0): in questo scambio non è stato accodato né estratto alcun ricordo.',
          )
        : say(
            'Il taccuino non è cambiato: niente di nuovo annotato, niente ripreso.',
            'I ricordi sono rimasti invariati: in questo scambio non è stata conservata né recuperata una frase.',
            `La coda dei ricordi resta invariata (${record.memory.sizeBefore} → ${record.memory.sizeAfter}): nessun ricordo accodato o estratto in questo scambio.`,
          )
      : memoryCreated
        ? say(
            'ELIZA ha annotato la tua frase nel taccuino, per riprenderla quando non saprà cosa dire.',
            'In questo scambio ELIZA ha preparato nuovi ricordi a partire dalle tue parole.',
            `La parola chiave usata ha una memoryPolicy, quindi il motore ha preparato ${counted(
              record.memory.createdEntries.length,
              'ricordo',
              'ricordi',
            )} e lo ha accodato (enqueue): la coda passa da ${record.memory.sizeBefore} a ${record.memory.sizeAfter}. Il template MEMORY è il n. ${
              (record.memory.selectionIndex ?? 0) + 1
            } di 4, scelto ${
              record.memory.selectionMethod === 'seeded'
                ? 'dal PRNG'
                : 'con l’hash Hollerith dell’ultima parola della clausola'
            }.`,
          )
        : say(
            'ELIZA non ha trovato parole conosciute e ha ripreso l’appunto più vecchio del taccuino.',
            'In questo scambio ELIZA ha recuperato il ricordo più vecchio, togliendolo dalla coda.',
            `Nessuna parola chiave e LIMIT = 4: il ricordo più vecchio è stato estratto dalla testa della coda (dequeue) e diventa la risposta. La coda passa da ${record.memory.sizeBefore} a ${record.memory.sizeAfter}.`,
          )) +
    (record.reflections.length
      ? memoryCreated
        ? say(
            ` Per scegliere quale frase usare, ha anche girato alcune parole dal tuo punto di vista al suo (${reflectionList}); nel taccuino resta però la tua frase originale.`,
            ` Per scegliere il modello del ricordo, alcune parole sono state riflesse (${reflectionList}): è una sostituzione grammaticale, non una comprensione, e il ricordo conserva la frase originale.`,
            ` Prima della scelta la clausola è stata riflessa (${reflectionList}): la riflessione serve solo a calcolare l’hash, mentre il ricordo conserva la frase originale.`,
          )
        : say(
            ` Ha anche girato alcune parole dal tuo punto di vista al suo (${reflectionList}).`,
            ` Alcune parole sono state riflesse (${reflectionList}): è una sostituzione grammaticale, non una comprensione.`,
            ` Riflessioni applicate: ${reflectionList}.`,
          )
      : '');
  const memoryCount = (count: number): string =>
    count === 0 ? 'Nessun ricordo' : counted(count, 'ricordo', 'ricordi');

  const steps: readonly Omit<TraceStep, 'glossary'>[] = [
    {
      title: say(
        'Legge quello che hai scritto',
        'Prepara le tue parole',
        'Normalizzazione e tokenizzazione',
      ),
      label: 'Testo',
      detail: say(
        'ELIZA divide la tua frase in pezzetti, più o meno uno per parola, e li riscrive in minuscolo. Così può confrontarli con il suo elenco di parole.',
        'ELIZA uniforma la scrittura (minuscole, apostrofi) e separa il messaggio in token, cioè piccoli pezzi di testo da confrontare con le regole.',
        `Il testo viene prima normalizzato con tre operazioni: forma Unicode NFC, conversione in minuscolo con le regole italiane (it-IT) e sostituzione degli apostrofi tipografici con l’apostrofo semplice. Poi il tokenizzatore lo divide in ${counted(record.tokens.length, 'token', 'token')} in base alle categorie Unicode dei caratteri: ${tokenSummary || 'nessuno'}. Infine il messaggio viene diviso in clausole a ogni virgola, punto, puntini di sospensione o «ma», e il motore analizza solo la prima che contiene una parola chiave${
          record.keywords.length
            ? `: qui ${quoted(record.activeClause)}`
            : '; in questo messaggio nessuna ne contiene'
        }.`,
      ),
      explanation: say(
        'Non sta capendo il significato: guarda solo come sono scritte le parole, lettera per lettera.',
        'Non interpreta il significato: prepara il testo per cercare espressioni che conosce già.',
        'Il motore non riconduce le parole alla forma base (per lui «sento» e «sentivo» sono parole diverse), non analizza la struttura grammaticale e non rappresenta il significato: confronta soltanto sequenze di caratteri già normalizzate. Per questo due frasi con lo stesso senso ma parole diverse possono seguire strade diverse.',
      ),
      comparison: {
        beforeLabel: 'Hai scritto',
        before: record.originalInput,
        afterLabel: say(
          'Come lo legge ELIZA',
          'Testo preparato per la ricerca',
          'Testo normalizzato',
        ),
        after: record.normalizedInput,
      },
      chips: words.map((token) =>
        level === 'expert'
          ? `${token.original} · ${tokenKindNames[token.kind][0]}`
          : token.original,
      ),
      technical: [
        `${counted(record.tokens.length, 'token', 'token')} in tutto, compresi spazi e punteggiatura.`,
        record.keywords.length
          ? `Clausola analizzata: ${quoted(record.activeClause)}.`
          : 'Nessuna clausola contiene parole chiave.',
        ...record.exceptions.filter((text) => text.startsWith('Input limitato')),
      ],
    },
    {
      title: say(
        'Cerca parole che conosce',
        'Cerca una parola da cui partire',
        'Ricerca delle parole chiave',
      ),
      label: 'Parole chiave',
      detail:
        record.fallback === 'repetition'
          ? say(
              'La frase è identica a quella di prima: ELIZA salta la ricerca e usa le frasi pensate per le ripetizioni.',
              'Il messaggio è uguale al precedente: le parole chiave riconosciute non vengono provate e si passa al percorso delle ripetizioni.',
              `Il messaggio, dopo la normalizzazione e la riduzione degli spazi multipli, è identico al precedente. In modalità ${mode} questo attiva il percorso delle ripetizioni: lo stack con ${counted(record.keywords.length, 'parola chiave trovata', 'parole chiave trovate')} non viene usato.`,
            )
          : record.keywords.length
            ? say(
                `Nella tua frase ha trovato ${counted(record.keywords.length, 'parola', 'parole')} del suo elenco. Ognuna ha un numero di importanza deciso da chi ha scritto le regole: ELIZA comincia da ${firstKeyword ? quoted(firstKeyword.trigger) : 'quella più importante'}.`,
                `Il primo gruppo di regole scelto è ${quoted(readableName(record.selectedKeyword ?? ''))}. Nell’albero vedi tutte le parole chiave riconosciute: quelle provate e quelle rimaste in attesa.`,
                `Nella clausola sono state trovate ${counted(record.keywords.length, 'parola chiave', 'parole chiave')}, inserite nello stack. Il motore estrae sempre la voce in testa: la prima è ${
                  firstKeyword
                    ? `${quoted(firstKeyword.trigger)} (${firstKeyword.keywordId}, priorità ${firstKeyword.priority})`
                    : 'la prima dello stack'
                }. Le voci mai estratte restano nello stack senza effetti e nell’albero compaiono come «non provate».`,
              )
            : say(
                'Nessuna parola della tua frase è nel suo elenco. Allora ELIZA prende un’altra strada: un appunto dal taccuino oppure una frase di riserva.',
                'Nessuna parola chiave riconosciuta: il messaggio passa al percorso di memoria o di risposta generica.',
                'Nessuna parola del messaggio è una parola chiave del copione, quindi lo stack resta vuoto. In questo caso il motore riprende un ricordo se LIMIT vale 4 e la coda dei ricordi non è vuota; altrimenti usa una risposta generica.',
              ),
      explanation: say(
        'È come cercare con l’evidenziatore le parole già note in un testo: non serve capire la frase, basta riconoscerle. Il numero di importanza decide solo l’ordine, non quanto ELIZA ti capisca.',
        'Ogni espressione conosciuta ha una precedenza scritta nel copione. Il numero stabilisce l’ordine di prova, non quanto ELIZA ti capisca. Le altre possono restare non provate.',
        'Lo stack si costruisce leggendo la clausola da sinistra a destra. Una parola chiave con priorità più alta di tutte quelle incontrate finora viene inserita in testa (unshift); le altre, comprese quelle con priorità uguale, vengono aggiunte in fondo (push). È la regola dell’ELIZA del 1966: l’ordine finale non è un ordinamento completo per priorità, perché dipende anche dalla posizione nella frase. Una stessa parola può attivare più parole chiave, per esempio «mi sento» e «mi».',
      ),
      technical: [
        'Regola dello stack: in testa (unshift) solo se la priorità supera il massimo visto finora, altrimenti in fondo (push).',
        ...record.keywords.map(
          (candidate) =>
            `${quoted(candidate.trigger)} → ${candidate.keywordId} · priorità ${candidate.priority} · al carattere ${candidate.position}`,
        ),
      ],
    },
    {
      title: say(
        'Prova a far combaciare la frase',
        'Controlla se la frase entra in uno schema',
        'Decomposizione',
      ),
      label: 'Schemi',
      detail: record.decompositions.length
        ? say(
            `Ha provato ${counted(record.decompositions.length, 'modello', 'modelli')} di frase: ${matchedCount} ${matchedCount === 1 ? 'combacia' : 'combaciano'}, ${rejectedCount} no. Quando un modello combacia, ELIZA ritaglia le parole che cadono negli spazi vuoti.`,
            'Ogni ramo è una prova realmente eseguita: lo schema accetta la frase oppure la scarta. I pezzi riconosciuti possono essere riutilizzati nella risposta.',
            `Sono stati provati ${counted(record.decompositions.length, 'schema', 'schemi')} (decomposizioni), nell’ordine in cui il copione li dichiara: ${matchedCount} ${matchedCount === 1 ? 'corrisponde' : 'corrispondono'}, ${rejectedCount} no. Il primo schema che corrisponde fornisce le catture usate nella risposta; gli schemi successivi della stessa parola chiave non vengono provati.`,
          )
        : say(
            'Questa volta non è servito provare modelli di frase.',
            'Per questa risposta non è stato necessario provare gli schemi delle frasi.',
            'Nessuno schema è stato provato: la risposta arriva da un percorso che non passa dagli schemi (messaggio vuoto, ripetuto o senza parole chiave).',
          ),
      explanation: say(
        'Funziona come un gioco a incastro: «mi sento ___» combacia con «mi sento triste» e ritaglia «triste». La forma combacia o non combacia: non c’è ragionamento.',
        'È come una frase con degli spazi da riempire: «mi sento ___» può raccogliere «triste». Una corrispondenza è un confronto di parole, non una deduzione.',
        'Uno schema è una sequenza di parti fisse (literal), parti fisse con alternative (oneOf) e spazi variabili (wildcard) che accettano da un minimo a un massimo di parole. Corrisponde solo se copre tutte le parole della clausola, dalla prima all’ultima. Per gli spazi variabili il motore prova prima la lunghezza minima e la allunga quando il resto dello schema non si incastra, tornando indietro sulle scelte sbagliate (backtracking). Se nessuno schema corrisponde, la parola chiave può rinviare a un tema di riserva (redirectTo); altrimenti si usa la risposta generica no-match.',
      ),
      chips: fragments(record.captures),
      technical: record.decompositions.map((attempt) => {
        const rule = script.keywords
          .find((keyword) => keyword.id === attempt.keywordId)
          ?.decompositions.find((candidate) => candidate.id === attempt.decompositionId);
        return `${attempt.decompositionId} · pattern: ${rule ? describePattern(rule.pattern) : 'non disponibile nel copione'} · ${
          attempt.matched
            ? `corrisponde${Object.keys(attempt.captures).length ? ` · catture: ${describeCaptures(attempt.captures)}` : ''}`
            : 'non corrisponde'
        }`;
      }),
    },
    {
      title: say(
        'Il taccuino dei ricordi',
        'Riusa parole e piccoli ricordi',
        'Memoria e riflessioni',
      ),
      label: 'Memoria',
      detail: memoryDetail,
      explanation: say(
        'Il taccuino contiene solo alcune tue frasi (per esempio quelle con «mio» o «mia»), non tutta la conversazione. ELIZA lo sfoglia solo ogni tanto, quando non riconosce nessuna parola. Ricaricando la pagina si svuota.',
        'Qui un «ricordo» è una frase preparata da un messaggio precedente e messa in coda, non tutta la conversazione. Solo alcune regole ne creano uno; in alcuni turni senza parole chiave ELIZA può recuperare il più vecchio. Tutto scompare ricaricando la pagina.',
        'Alcune parole chiave hanno una memoryPolicy: quando vengono usate, il motore prepara anche un ricordo, cioè uno dei quattro template MEMORY del copione completato con la clausola, e lo accoda in una coda FIFO senza limite di dimensione. Il template si sceglie con l’hash Hollerith nelle modalità storica e deterministica, con il PRNG nella variata. Un ricordo viene ripreso solo quando non c’è nessuna parola chiave e il contatore LIMIT vale 4. Tutto vive nella memoria della scheda e sparisce ricaricando la pagina.',
      ),
      comparison: {
        beforeLabel: 'Prima di questo messaggio',
        before: memoryCount(record.memory.sizeBefore),
        afterLabel: 'Dopo questo messaggio',
        after: memoryCount(record.memory.sizeAfter),
      },
      chips: record.reflections.map((change) => `${change.original} → ${change.replacement}`),
      technical: [
        `Ricordi in coda: ${record.memory.sizeBefore} prima, ${record.memory.sizeAfter} dopo. LIMIT in questo turno: ${record.limit}.`,
        `Scelta del template MEMORY: ${
          record.memory.selectionMethod === 'hash'
            ? 'hash Hollerith'
            : record.memory.selectionMethod === 'seeded'
              ? 'PRNG'
              : 'nessuna in questo turno'
        }${
          record.memory.selectionIndex === null
            ? ''
            : `, indice ${record.memory.selectionIndex} (template n. ${record.memory.selectionIndex + 1} di 4)`
        }.`,
        ...record.reflections.map(
          (change) =>
            `Riflessione (${reflectionNames[change.category]}): ${quoted(change.original)} → ${quoted(change.replacement)}`,
        ),
      ],
    },
    {
      title: say(
        'Sceglie una frase già pronta',
        'Sceglie fra risposte già scritte',
        'Ricomposizione',
      ),
      label: 'Scelta',
      detail: method,
      explanation: say(
        'Tutte le frasi possibili sono state scritte a mano da una persona. Nell’albero vedi quella scelta e quelle rimaste in attesa. I puntini «…» sono gli spazi dove ELIZA incolla le tue parole.',
        'Le possibilità sono scritte nel copione. «Alternativa» non significa che una frase sia sbagliata: è solo una possibilità non scelta in questo turno. I puntini indicano dove inserire le tue parole.',
        'Ogni schema ha una o più ricomposizioni, cioè modelli di risposta con segnaposto come {{stato}} che vengono sostituiti dalle catture. Prima dell’inserimento, le catture elencate nel campo reflect della ricomposizione passano per la riflessione; se una riflessione non è sicura o manca una cattura, si usa la frase prudente di riserva prevista. Due ricomposizioni speciali non producono testo: redirect rimanda a un altro tema, NEWKEY passa alla voce successiva dello stack. Per evitare cicli, dopo 64 passaggi il motore si ferma e usa una risposta generica.',
      ),
      comparison:
        chosenReply?.kind === 'reply' &&
        chosenReply.template.includes('{{') &&
        record.fallback !== 'safe-language'
          ? {
              beforeLabel: 'Frase scritta nel copione',
              before: withGaps(chosenReply.template),
              afterLabel: 'Dopo aver inserito le tue parole',
              after: record.response,
            }
          : undefined,
      technical: [
        `Ricomposizione usata: ${record.reassemblyId ?? 'nessuna'} · indice di rotazione: ${record.rotationIndex ?? 'non usato'} · LIMIT: ${record.limit}.`,
        ...record.randomDraws.map(
          (draw) =>
            `Estrazione del PRNG per ${draw.purpose}: alternativa ${draw.index + 1} di ${draw.maxExclusive} · stato ${draw.stateBefore} → ${draw.stateAfter}`,
        ),
        ...record.exceptions.filter((text) => !text.startsWith('Input limitato')),
      ],
    },
    {
      title: say('Ecco la risposta', 'Ecco come nasce la risposta', 'Output'),
      label: 'Risposta',
      detail: record.response,
      explanation: say(
        'Sembra una risposta pensata, ma è il risultato di un incastro di regole: ELIZA non ha capito né provato nulla. I chatbot moderni basati sugli LLM (grandi modelli linguistici) lavorano in modo diverso: scrivono la risposta parola per parola, calcolando quale parola è più probabile dopo aver letto enormi quantità di testo. ELIZA sceglie solo fra frasi già scritte.',
        'Questo è il risultato delle regole appena mostrate. Può sembrare pertinente, ma non dimostra che ELIZA abbia capito o provi qualcosa. Un LLM, al contrario, genera il testo un token alla volta (di solito un frammento di parola) in base a probabilità apprese dai dati: non ha un copione di frasi intere.',
        'La risposta è interamente determinata da copione, messaggio e stato del motore (LIMIT, indici di rotazione, coda dei ricordi, stato del PRNG): con gli stessi ingressi si ottiene sempre la stessa risposta, e ogni ramo dell’albero si può ispezionare. Un LLM funziona in modo diverso: a ogni passo calcola una distribuzione di probabilità su tutti i token del suo vocabolario e ne sceglie uno, costruendo la risposta pezzo per pezzo, senza un copione di frasi intere.',
      ),
      technical: [
        `Percorso di riserva: ${
          record.fallback
            ? (fallbackDescriptions[record.fallback] ?? record.fallback)
            : 'nessuno, risposta dal percorso normale'
        } · messaggio ripetuto: ${record.repeated ? 'sì' : 'no'} · modalità: ${mode}.`,
      ],
    },
  ];

  return steps.map((step, index) => ({
    ...step,
    glossary:
      level === 'beginner'
        ? []
        : glossaryFor([
            step.title,
            // L'ultimo dettaglio è la risposta di ELIZA, non una spiegazione.
            index === steps.length - 1 ? '' : step.detail,
            step.explanation,
            ...step.technical,
          ]),
  }));
}

const stateLabels: Record<BranchState, string> = {
  selected: 'Scelto',
  matched: 'Verificato',
  rejected: 'Scartato',
  unvisited: 'Non provato',
  alternative: 'Alternativa',
};

const stateMarks: Record<BranchState, string> = {
  selected: '✓',
  matched: '✓',
  rejected: '×',
  unvisited: '·',
  alternative: '○',
};

const legendLabels: Record<BranchState, readonly [string, string]> = {
  selected: ['nel percorso scelto', 'nel percorso scelto'],
  matched: ['verificato', 'verificati'],
  rejected: ['scartato', 'scartati'],
  unvisited: ['non provato', 'non provati'],
  alternative: ['alternativa', 'alternative'],
};

function isLevel(value: string | undefined): value is ExplanationLevel {
  return value === 'beginner' || value === 'intermediate' || value === 'expert';
}

function textElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text: string,
): HTMLElementTagNameMap[K] {
  const created = document.createElement(tag);
  if (className) created.className = className;
  created.textContent = text;
  return created;
}

function glossaryItems(entries: readonly GlossaryEntry[]): HTMLElement[] {
  return entries.flatMap((entry) => [
    textElement('dt', '', entry.term),
    textElement('dd', '', entry.definition),
  ]);
}

function renderNode(node: DecisionNode): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'tree-node';
  item.dataset.state = node.state;
  item.dataset.kind = node.kind;
  item.dataset.step = String(node.step);
  const card = document.createElement('div');
  card.className = 'tree-card';
  const mark = textElement(
    'span',
    'tree-mark',
    node.kind === 'input'
      ? '●'
      : node.kind === 'response'
        ? '★'
        : node.kind === 'route' && node.state === 'selected'
          ? '↳'
          : stateMarks[node.state],
  );
  mark.setAttribute('aria-hidden', 'true');
  const badge = textElement(
    'span',
    'tree-badge',
    node.kind === 'input'
      ? 'Messaggio'
      : node.kind === 'response'
        ? 'Risposta'
        : stateLabels[node.state],
  );
  card.append(
    mark,
    badge,
    textElement('span', 'tree-label', node.label),
    textElement('span', 'tree-note', node.note),
  );
  item.append(card);
  if (node.children.length) {
    const list = document.createElement('ul');
    list.className = 'tree-children';
    list.append(...node.children.map(renderNode));
    item.append(list);
  }
  return item;
}

function renderStep(
  step: TraceStep,
  index: number,
  level: ExplanationLevel,
  glossaryOpen: boolean,
): HTMLElement[] {
  const title = textElement('h3', '', `${String(index + 1).padStart(2, '0')} / ${step.title}`);
  title.id = 'trace-step-title';
  title.tabIndex = -1;
  const parts: HTMLElement[] = [title, textElement('p', 'step-detail', step.detail)];
  if (step.comparison) {
    const comparison = document.createElement('div');
    comparison.className = 'trace-comparison';
    for (const [label, value] of [
      [step.comparison.beforeLabel, step.comparison.before],
      [step.comparison.afterLabel, step.comparison.after],
    ] as const) {
      const card = document.createElement('div');
      card.append(textElement('span', '', label), textElement('strong', '', value));
      comparison.append(card);
    }
    parts.push(comparison);
  }
  if (step.chips?.length) {
    const chips = document.createElement('div');
    chips.className = 'trace-chips';
    chips.setAttribute('aria-label', 'Pezzi del messaggio');
    chips.append(...step.chips.map((text) => textElement('span', '', text)));
    parts.push(chips);
  }
  parts.push(textElement('p', 'step-explanation', step.explanation));
  if (step.glossary.length) {
    const glossary = document.createElement('details');
    glossary.className = 'glossary';
    glossary.open = glossaryOpen;
    const list = document.createElement('dl');
    list.append(...glossaryItems(step.glossary));
    glossary.append(
      textElement(
        'summary',
        '',
        `Glossario di questo passaggio (${counted(step.glossary.length, 'termine', 'termini')})`,
      ),
      list,
    );
    parts.push(glossary);
  }
  if (step.technical.length && level !== 'beginner') {
    const technical = document.createElement('details');
    technical.className = 'step-technical';
    technical.open = level === 'expert';
    technical.append(
      textElement(
        'summary',
        '',
        level === 'expert' ? 'Dettagli tecnici' : 'Per chi vuole i dettagli tecnici',
      ),
      textElement('pre', '', step.technical.join('\n')),
    );
    parts.push(technical);
  }
  return parts;
}

export function createTracePanel(dialog: HTMLDialogElement, script: ElizaScript) {
  function part<T extends HTMLElement>(selector: string): T {
    const found = dialog.querySelector<T>(selector);
    if (!found) throw new Error(`Controllo del pannello decisionale mancante: ${selector}`);
    return found;
  }
  const summary = part('#trace-summary');
  const levelSwitch = part('#trace-level-switch');
  const picker = part('#trace-level-picker');
  const pickerTitle = part('#level-picker-title');
  const stepper = part('#trace-stepper');
  const explorer = part('#trace-explorer');
  const navigation = part('#trace-navigation');
  const previousButton = part<HTMLButtonElement>('#trace-previous');
  const nextButton = part<HTMLButtonElement>('#trace-next');
  const allButton = part<HTMLButtonElement>('#trace-all');
  const progress = part('#trace-progress');
  const stepView = part('#trace-step');
  const legend = part('#trace-legend');
  const tree = part('#decision-tree');
  const treeTerms = part<HTMLDetailsElement>('#tree-glossary');
  const treeTermsTitle = part('#tree-glossary summary');
  const treeTermsList = part('#tree-glossary dl');
  const fields = part('#trace-content');
  const scroller = part('.dialog-body');
  const switchButtons = Array.from(levelSwitch.querySelectorAll<HTMLButtonElement>('[data-level]'));
  let level: ExplanationLevel | null = null;
  let latest: TraceRecord | null = null;
  let steps: readonly TraceStep[] = [];
  let root: DecisionNode | null = null;
  let current = 0;
  let notice = '';
  // Aperto di default per gli esperti; se l'utente lo chiude resta chiuso nei passaggi seguenti.
  let glossaryOpen = false;

  function rebuild(): void {
    steps = level && latest ? decisionSteps(latest, script, level) : [];
    root = level && latest ? decisionTree(latest, script, level) : null;
    navigation.replaceChildren(
      ...steps.map((step, index) => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('aria-label', `Passaggio ${index + 1}: ${step.title}`);
        button.append(
          textElement('span', 'step-number', String(index + 1)),
          textElement('span', 'step-name', step.label),
        );
        button.addEventListener('click', () => showStep(index));
        item.append(button);
        return item;
      }),
    );
    tree.replaceChildren(...(root ? [renderNode(root)] : []));
  }

  function revealTree(index: number): void {
    tree.querySelectorAll<HTMLLIElement>('.tree-node').forEach((item) => {
      const step = Number(item.dataset.step);
      item.hidden = step > index;
      item.toggleAttribute('data-new', step === index);
    });
    tree.querySelectorAll<HTMLUListElement>('.tree-children').forEach((list) => {
      const visible = Array.from(list.children).filter(
        (child): child is HTMLElement => child instanceof HTMLElement && !child.hidden,
      );
      list.hidden = visible.length === 0;
      const path = visible.findIndex((item) => item.dataset.state === 'selected');
      visible.forEach((item, position) => {
        item.dataset.trunk = path > position ? 'path' : path === position ? 'joint' : 'dim';
        item.toggleAttribute('data-last', position === visible.length - 1);
      });
    });
    const counts = new Map<BranchState, number>();
    tree.querySelectorAll<HTMLElement>('.tree-node:not([hidden])').forEach((item) => {
      const state = item.dataset.state as BranchState;
      counts.set(state, (counts.get(state) ?? 0) + 1);
    });
    legend.replaceChildren(
      ...(Object.keys(stateLabels) as BranchState[])
        .filter((state) => counts.has(state))
        .map((state) => {
          const count = counts.get(state) ?? 0;
          const entry = document.createElement('li');
          entry.dataset.state = state;
          const mark = textElement('span', 'tree-mark', stateMarks[state]);
          mark.setAttribute('aria-hidden', 'true');
          const [one, many] = legendLabels[state];
          entry.append(mark, document.createTextNode(counted(count, one, many)));
          return entry;
        }),
    );
    const terms = root && level !== 'beginner' ? treeGlossary(root, index) : [];
    treeTerms.hidden = terms.length === 0;
    treeTermsTitle.textContent = `Termini usati nell’albero (${counted(terms.length, 'termine', 'termini')})`;
    treeTermsList.replaceChildren(...glossaryItems(terms));
  }

  function showStep(index: number): void {
    picker.hidden = level !== null;
    explorer.hidden = level === null;
    levelSwitch.hidden = level === null;
    stepper.hidden = level === null;
    switchButtons.forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.level === level)),
    );
    const step = steps[index];
    if (!level || !step) {
      current = 0;
      progress.textContent = notice;
      stepView.replaceChildren();
      legend.replaceChildren();
      treeTerms.hidden = true;
      previousButton.disabled = true;
      nextButton.disabled = true;
      allButton.disabled = true;
      return;
    }
    current = index;
    progress.textContent = `Passaggio ${index + 1} di ${steps.length} · ${step.title}`;
    stepView.replaceChildren(...renderStep(step, index, level, glossaryOpen));
    const glossary = stepView.querySelector<HTMLDetailsElement>('.glossary');
    glossary?.addEventListener('toggle', () => {
      glossaryOpen = glossary.open;
    });
    navigation.querySelectorAll<HTMLButtonElement>('button').forEach((button, position) => {
      button.dataset.state =
        position < index ? 'complete' : position === index ? 'active' : 'pending';
      if (position === index) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    revealTree(index);
    previousButton.disabled = index === 0;
    nextButton.disabled = index >= steps.length - 1;
    allButton.disabled = index >= steps.length - 1;
    scroller.scrollTop = 0;
  }

  function setLevel(value: ExplanationLevel, fromPicker: boolean): void {
    level = value;
    glossaryOpen = value === 'expert';
    treeTerms.open = glossaryOpen;
    rebuild();
    showStep(Math.min(current, Math.max(steps.length - 1, 0)));
    if (fromPicker) (dialog.querySelector<HTMLElement>('#trace-step-title') ?? progress).focus();
  }

  function renderFields(record: TraceRecord): void {
    const list = document.createElement('dl');
    list.className = 'trace-fields';
    for (const [name, value] of Object.entries(record)) {
      const row = document.createElement('div');
      row.className = 'trace-field';
      row.append(
        textElement('dt', '', name),
        textElement('dd', '', typeof value === 'string' ? value : JSON.stringify(value, null, 2)),
      );
      list.append(row);
    }
    fields.replaceChildren(list);
  }

  function clear(message = 'Invia un messaggio: la raccolta della traccia è già attiva.'): void {
    latest = null;
    notice = message;
    summary.textContent = 'Nessuna traccia disponibile';
    fields.replaceChildren();
    rebuild();
    showStep(0);
  }

  function show(record: TraceRecord, turn: number): void {
    latest = record;
    summary.textContent = `Scambio ${turn} · ${record.selectionMode.toUpperCase()}`;
    renderFields(record);
    rebuild();
    showStep(0);
  }

  function opened(): void {
    if (level === null) pickerTitle.focus();
  }

  dialog.querySelectorAll<HTMLButtonElement>('[data-level]').forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.dataset.level;
      if (isLevel(value)) setLevel(value, picker.contains(button));
    });
  });
  previousButton.addEventListener('click', () => showStep(current - 1));
  nextButton.addEventListener('click', () => showStep(current + 1));
  allButton.addEventListener('click', () => showStep(steps.length - 1));
  clear();
  return { show, clear, opened };
}
