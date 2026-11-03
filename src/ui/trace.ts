import type { ElizaScript, PatternTerm, TraceRecord } from '../core/types';

type BranchState = 'selected' | 'matched' | 'rejected' | 'unvisited' | 'alternative';

interface TraceBranch {
  readonly state: BranchState;
  readonly text: string;
}

export interface TraceStep {
  readonly title: string;
  readonly label: string;
  readonly detail: string;
  readonly explanation: string;
  readonly branches: readonly TraceBranch[];
  readonly technical: readonly string[];
  readonly chips?: readonly string[];
  readonly comparison?: {
    readonly beforeLabel: string;
    readonly before: string;
    readonly afterLabel: string;
    readonly after: string;
  };
}

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

export function decisionSteps(record: TraceRecord, script: ElizaScript): readonly TraceStep[] {
  const visited = new Set(record.decompositions.map((attempt) => attempt.keywordId));
  if (record.selectedKeyword) visited.add(record.selectedKeyword);
  record.redirectChain.forEach((target) => visited.add(target));
  const selectedRule = script.keywords
    .flatMap((keyword) => keyword.decompositions)
    .find(
      (rule) =>
        rule.id === record.selectedDecomposition &&
        rule.reassemblies.some((choice) => choice.id === record.reassemblyId),
    );
  const chosenReply = selectedRule?.reassemblies.find((rule) => rule.id === record.reassemblyId);
  const method = record.memory.recalled
    ? 'ELIZA riprende il ricordo conservato da più tempo, invece di scegliere una nuova frase.'
    : record.fallback === 'empty-input'
      ? 'Non ci sono parole da usare: ELIZA restituisce una frase fissa per chiederti di scrivere.'
      : record.fallback === 'no-match' && record.selectionMode !== 'varied'
        ? 'Nessuno schema ha prodotto una risposta. Un contatore che si ripete sceglie una delle frasi generiche.'
        : record.selectionMode === 'varied'
          ? `Una scelta casuale guidata decide fra frasi già scritte. Il numero iniziale, chiamato seed (${record.seed}), permette di ripetere la stessa sequenza.`
          : 'Le frasi già scritte vengono usate a turno: la prima volta una, la volta successiva un’altra, poi si ricomincia. Non vengono inventate nuove risposte.';
  const memoryUnchanged =
    record.memory.createdEntries.length === 0 && record.memory.recalled === null;
  const memoryDetail = memoryUnchanged
    ? record.memory.sizeBefore === 0 && record.memory.sizeAfter === 0
      ? 'Nessun ricordo prima, nessun ricordo dopo. In questo scambio ELIZA non ha conservato né recuperato una frase. Non è un punteggio: la memoria è semplicemente vuota.'
      : 'I ricordi sono rimasti invariati: in questo scambio non è stata conservata né recuperata una frase.'
    : `In questo scambio ${
        record.memory.createdEntries.length
          ? 'ELIZA ha preparato nuovi ricordi a partire dalle tue parole'
          : 'ELIZA ha recuperato il ricordo più vecchio, togliendolo dalla coda'
      }.`;
  const memoryCount = (count: number): string =>
    count === 0 ? 'Nessun ricordo' : `${count} ${count === 1 ? 'ricordo' : 'ricordi'}`;
  const readableName = (id: string): string => id.replace(/^it-/u, '').replace(/-/gu, ' ');
  return [
    {
      title: 'Prepara le tue parole',
      label: 'Testo',
      detail:
        'ELIZA uniforma la scrittura e separa il messaggio in piccoli pezzi, per poter confrontare le parole con le sue regole.',
      explanation:
        'Non sta interpretando il significato: prepara il testo per cercare espressioni che conosce già.',
      comparison: {
        beforeLabel: 'Hai scritto',
        before: record.originalInput,
        afterLabel: 'Testo preparato per la ricerca',
        after: record.normalizedInput,
      },
      chips: record.tokens
        .filter((token) => token.kind !== 'whitespace')
        .map((token) => token.original),
      branches: [
        { state: 'selected', text: `Parte del messaggio su cui lavora: «${record.activeClause}»` },
      ],
      technical: [`${record.tokens.length} token, inclusi spazi e punteggiatura.`],
    },
    {
      title: 'Cerca una parola da cui partire',
      label: 'Indizi',
      detail: record.selectedKeyword
        ? `Il primo gruppo di regole scelto è «${readableName(record.selectedKeyword)}». Qui sotto vedi le espressioni riconosciute e quelle effettivamente usate.`
        : 'Il messaggio passa al percorso di ripetizione, memoria o risposta generica: non è stata scelta una parola da cui partire.',
      explanation:
        'Ogni espressione conosciuta ha una precedenza scritta nel copione. Il numero stabilisce l’ordine di prova, non quanto ELIZA ti capisca. Le altre possono restare non provate.',
      branches: record.keywords.length
        ? record.keywords.map((candidate) => ({
            state: visited.has(candidate.keywordId) ? 'matched' : 'unvisited',
            text: `«${candidate.trigger}» · precedenza ${candidate.priority}${
              candidate.keywordId === record.selectedKeyword ? ' · da qui parte la ricerca' : ''
            }`,
          }))
        : [{ state: 'rejected', text: 'Nessuna parola chiave riconosciuta' }],
      technical: [
        'Coda storica: una nuova priorità massima passa in testa; le altre occorrenze si accodano. Non è un ordinamento globale.',
        ...record.keywords.map((candidate) => `${candidate.trigger}: ${candidate.keywordId}`),
      ],
    },
    {
      title: 'Controlla se la frase entra in uno schema',
      label: 'Prove',
      detail: record.decompositions.length
        ? 'Ogni ramo qui sotto è una prova realmente eseguita: lo schema accetta la frase oppure la scarta. I pezzi riconosciuti possono essere riutilizzati nella risposta.'
        : 'Per questa risposta non è stato necessario provare gli schemi delle frasi.',
      explanation:
        'È come una frase con degli spazi da riempire: «mi sento ___» può raccogliere «triste». Una corrispondenza è un confronto di parole, non una deduzione.',
      chips: Object.values(record.captures).filter(Boolean),
      branches: record.decompositions.length
        ? record.decompositions.map((attempt, index) => {
            const fragments = Object.values(attempt.captures).filter(Boolean);
            return {
              state: attempt.matched ? 'matched' : 'rejected',
              text: `Prova ${index + 1}, tema «${readableName(attempt.keywordId)}»: ${
                attempt.matched
                  ? `la frase corrisponde${fragments.length ? `. Pezzi raccolti: ${fragments.map((text) => `«${text}»`).join(', ')}` : ''}`
                  : 'la frase non corrisponde a questo schema'
              }.`,
            };
          })
        : [
            {
              state: 'unvisited',
              text:
                record.repeated && record.selectionMode !== 'historical'
                  ? 'Nessun tentativo: verifica il percorso di ripetizione / risposta'
                  : 'Nessuno schema provato: si segue un altro percorso',
            },
          ],
      technical: record.decompositions.map((attempt) => {
        const rule = script.keywords
          .find((keyword) => keyword.id === attempt.keywordId)
          ?.decompositions.find((rule) => rule.id === attempt.decompositionId);
        return `${attempt.decompositionId} · pattern: ${rule ? describePattern(rule.pattern) : 'non disponibile nel copione'}`;
      }),
    },
    {
      title: 'Riusa parole e piccoli ricordi',
      label: 'Memoria',
      detail: memoryDetail,
      explanation:
        'Qui un «ricordo» è una frase preparata da un messaggio precedente e messa in coda, non tutta la conversazione. Solo alcune regole ne creano uno; in alcuni turni senza parole chiave ELIZA può recuperare il più vecchio. Tutto scompare ricaricando la pagina.',
      comparison: {
        beforeLabel: 'Prima di questo messaggio',
        before: memoryCount(record.memory.sizeBefore),
        afterLabel: 'Dopo questo messaggio',
        after: memoryCount(record.memory.sizeAfter),
      },
      branches: [
        ...record.redirectChain.map((target): TraceBranch => ({
          state: 'matched',
          text: `La ricerca è passata al tema «${readableName(target)}».`,
        })),
        ...record.reflections.map((change): TraceBranch => ({
          state: 'matched',
          text: `Per cambiare il punto di vista nella frase: «${change.original}» → «${change.replacement}». È una sostituzione grammaticale, non una comprensione.`,
        })),
        ...(record.reflections.length === 0
          ? [
              {
                state: 'unvisited' as const,
                text: 'Nessun pronome o verbo è stato cambiato in questo scambio.',
              },
            ]
          : []),
        ...record.memory.createdEntries.map((text): TraceBranch => ({
          state: 'matched',
          text: `Conservato per un turno futuro: «${text}»`,
        })),
        ...(record.memory.recalled
          ? [
              {
                state: 'selected' as const,
                text: `Ripreso dalla memoria: «${record.memory.recalled}»`,
              },
            ]
          : []),
      ],
      technical: [
        `Memoria prima: ${record.memory.sizeBefore}; dopo: ${record.memory.sizeAfter}.`,
        `Selezione memoria: ${record.memory.selectionMethod ?? 'non usata'}; indice: ${record.memory.selectionIndex ?? 'non usato'}. Richiamo FIFO (primo entrato, primo uscito).`,
      ],
    },
    {
      title: 'Sceglie fra risposte già scritte',
      label: 'Scelta',
      detail: method,
      explanation:
        'Le possibilità sono scritte nel copione. «Altra possibilità» non significa che una frase sia sbagliata: è solo un’alternativa non scelta. I puntini indicano dove inserire le tue parole.',
      comparison:
        chosenReply?.kind === 'reply' &&
        chosenReply.template.includes('{{') &&
        record.fallback !== 'safe-language'
          ? {
              beforeLabel: 'Frase scritta nel copione',
              before: chosenReply.template.replace(/\{\{[^}]+\}\}/gu, '…'),
              afterLabel: 'Dopo aver inserito le tue parole',
              after: record.response,
            }
          : undefined,
      branches: [
        ...(selectedRule?.reassemblies.map((rule): TraceBranch => ({
          state: rule.id === record.reassemblyId ? 'selected' : 'alternative',
          text: `${
            rule.kind === 'reply'
              ? `«${rule.template.replace(/\{\{[^}]+\}\}/gu, '…')}»`
              : rule.kind === 'redirect'
                ? `Sposta la ricerca al tema «${readableName(rule.target)}»`
                : 'Prova la parola chiave successiva'
          }`,
        })) ?? []),
        ...(record.fallback
          ? [
              {
                state: 'selected' as const,
                text:
                  record.fallback === 'repetition'
                    ? 'Il messaggio è uguale al precedente: viene usata una frase dedicata alle ripetizioni.'
                    : record.fallback === 'safe-language'
                      ? 'Una riformulazione grammaticale non era sicura: viene usata una frase prudente già prevista.'
                      : 'È stato usato un percorso alternativo del copione, non una nuova interpretazione del messaggio.',
              },
            ]
          : []),
        ...record.exceptions.map((text): TraceBranch => ({ state: 'rejected', text })),
      ],
      technical: [
        `Ricomposizione: ${record.reassemblyId ?? 'nessuna'} · indice di rotazione: ${record.rotationIndex ?? 'non usato'} · LIMIT: ${record.limit}.`,
        ...record.randomDraws.map(
          (draw) =>
            `${draw.purpose}: alternativa ${draw.index + 1} di ${draw.maxExclusive} · stato ${draw.stateBefore} → ${draw.stateAfter}`,
        ),
      ],
    },
    {
      title: 'Ecco come nasce la risposta',
      label: 'Risposta',
      detail: record.response,
      explanation:
        'Questo è il risultato delle regole appena mostrate. Può sembrare pertinente, ma non dimostra che ELIZA abbia capito o provi qualcosa.',
      branches: [],
      technical: [],
    },
  ];
}

const branchLabels: Record<BranchState, string> = {
  selected: 'Usata',
  matched: 'Verificata',
  rejected: 'Non corrisponde',
  unvisited: 'Non provata',
  alternative: 'Altra possibilità',
};

export function createTracePanel(
  dialog: HTMLDialogElement,
  script: ElizaScript,
  motionEnabled: () => boolean,
) {
  const content = dialog.querySelector<HTMLElement>('#decision-tree');
  const summary = dialog.querySelector<HTMLElement>('#trace-summary');
  const raw = dialog.querySelector<HTMLElement>('#trace-content');
  const replay = dialog.querySelector<HTMLButtonElement>('#trace-replay');
  const progress = dialog.querySelector<HTMLElement>('#trace-progress');
  const body = dialog.querySelector<HTMLElement>('.dialog-body');
  const pause = dialog.querySelector<HTMLButtonElement>('#trace-pause');
  const next = dialog.querySelector<HTMLButtonElement>('#trace-next');
  const all = dialog.querySelector<HTMLButtonElement>('#trace-all');
  const navigation = dialog.querySelector<HTMLElement>('#trace-navigation');
  if (
    !content ||
    !summary ||
    !raw ||
    !replay ||
    !progress ||
    !body ||
    !pause ||
    !next ||
    !all ||
    !navigation
  ) {
    throw new Error('Controlli del pannello decisionale mancanti.');
  }
  const tree = content;
  const heading = summary;
  const fields = raw;
  const replayButton = replay;
  const progressLabel = progress;
  const scroller = body;
  const pauseButton = pause;
  const nextButton = next;
  const allButton = all;
  const navigationBar = navigation;
  let latest: TraceRecord | null = null;
  let steps: readonly TraceStep[] = [];
  let current = -1;
  let running = false;
  let timer: number | null = null;

  function cancelTimer(): void {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
  }

  function syncPlayback(): void {
    pauseButton.disabled = !latest || current < 0 || !motionEnabled();
    pauseButton.textContent = running ? 'Pausa' : 'Riprendi';
    nextButton.disabled = !latest || current < 0 || current >= steps.length - 1;
    allButton.disabled = !latest;
    navigationBar.querySelectorAll<HTMLButtonElement>('button').forEach((button, index) => {
      button.dataset.state =
        current < 0
          ? 'complete'
          : index < current
            ? 'complete'
            : index === current
              ? 'active'
              : 'pending';
      if (index === current) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
  }

  function scrollToStep(step: HTMLElement): void {
    scroller.scrollTop +=
      step.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 12;
  }

  function finish(): void {
    cancelTimer();
    const anchor = tree.children[current];
    running = false;
    current = -1;
    tree.dataset.view = 'all';
    tree.dataset.playback = 'paused';
    tree.querySelectorAll<HTMLElement>('.decision-step').forEach((step) => {
      step.dataset.state = 'complete';
    });
    progressLabel.textContent = latest ? 'Percorso completo' : '';
    syncPlayback();
    if (dialog.open && anchor instanceof HTMLElement) scrollToStep(anchor);
  }

  function activate(index: number, automatic: boolean): void {
    const step = steps[index];
    if (!step || !latest) return;
    cancelTimer();
    current = index;
    running = automatic && motionEnabled();
    tree.dataset.view = 'scene';
    tree.dataset.playback = running ? 'running' : 'paused';
    tree.querySelectorAll<HTMLElement>('.decision-step').forEach((item, position) => {
      item.dataset.state =
        position === index ? 'active' : position < index ? 'complete' : 'pending';
    });
    progressLabel.textContent = `Passaggio ${index + 1} di ${steps.length} · ${step.title}`;
    syncPlayback();
    scroller.scrollTop = 0;
    if (running) {
      tree.getAnimations({ subtree: true }).forEach((animation) => {
        animation.currentTime = 0;
        animation.play();
      });
      timer = window.setTimeout(() => {
        if (index + 1 < steps.length) activate(index + 1, true);
        else finish();
      }, 3000);
    }
  }

  function play(): void {
    if (!latest || !dialog.open) return;
    if (!motionEnabled()) {
      finish();
      return;
    }
    activate(0, true);
  }

  function clear(message = 'Invia un messaggio: la raccolta della traccia è già attiva.'): void {
    latest = null;
    steps = [];
    finish();
    tree.replaceChildren();
    navigationBar.replaceChildren();
    fields.replaceChildren();
    scroller.scrollTop = 0;
    heading.textContent = 'Nessuna traccia disponibile';
    progressLabel.textContent = message;
    replayButton.disabled = true;
  }

  function show(record: TraceRecord, turn: number): void {
    clear();
    latest = record;
    steps = decisionSteps(record, script);
    heading.textContent = `Scambio ${turn} · ${record.selectionMode.toUpperCase()}`;
    replayButton.disabled = false;
    steps.forEach((step, index) => {
      const jump = document.createElement('button');
      jump.type = 'button';
      jump.textContent = `${index + 1}. ${step.label}`;
      jump.setAttribute('aria-label', `Passaggio ${index + 1}: ${step.title}`);
      jump.addEventListener('click', () => activate(index, false));
      navigationBar.append(jump);
      const item = document.createElement('li');
      item.className = 'decision-step';
      const title = document.createElement('h3');
      title.textContent = `${String(index + 1).padStart(2, '0')} / ${step.title}`;
      const detail = document.createElement('p');
      detail.textContent = step.detail;
      item.append(title, detail);
      if (step.comparison) {
        const comparison = document.createElement('div');
        comparison.className = 'trace-comparison';
        for (const [label, value] of [
          [step.comparison.beforeLabel, step.comparison.before],
          [step.comparison.afterLabel, step.comparison.after],
        ]) {
          const card = document.createElement('div');
          const caption = document.createElement('span');
          caption.textContent = label ?? '';
          const text = document.createElement('strong');
          text.textContent = value ?? '';
          card.append(caption, text);
          comparison.append(card);
        }
        item.append(comparison);
      }
      if (step.chips?.length) {
        const chips = document.createElement('div');
        chips.className = 'trace-chips';
        chips.setAttribute('aria-label', 'Pezzi del messaggio');
        step.chips.forEach((text, position) => {
          const chip = document.createElement('span');
          chip.textContent = text;
          chip.style.setProperty('--item-index', String(Math.min(position, 8)));
          chips.append(chip);
        });
        item.append(chips);
      }
      if (step.branches.length) {
        const branches = document.createElement('ul');
        branches.className = 'decision-branches';
        for (const [position, branch] of step.branches.entries()) {
          const node = document.createElement('li');
          node.dataset.result = branch.state;
          node.style.setProperty('--item-index', String(Math.min(position, 8)));
          const check = document.createElement('span');
          check.className = 'decision-check';
          check.setAttribute('aria-hidden', 'true');
          check.textContent =
            branch.state === 'rejected'
              ? '×'
              : branch.state === 'unvisited' || branch.state === 'alternative'
                ? '–'
                : '✓';
          const badge = document.createElement('span');
          badge.className = 'decision-badge';
          badge.textContent = branchLabels[branch.state];
          node.append(check, badge, document.createTextNode(branch.text));
          branches.append(node);
        }
        item.append(branches);
      }
      const explanation = document.createElement('p');
      explanation.className = 'step-explanation';
      explanation.textContent = step.explanation;
      item.append(explanation);
      if (step.technical.length) {
        const technical = document.createElement('details');
        technical.className = 'step-technical';
        const summary = document.createElement('summary');
        summary.textContent = 'Per chi vuole i dettagli tecnici';
        const text = document.createElement('pre');
        text.textContent = step.technical.join('\n');
        technical.append(summary, text);
        item.append(technical);
      }
      tree.append(item);
    });
    const list = document.createElement('dl');
    list.className = 'trace-fields';
    for (const [name, value] of Object.entries(record)) {
      const row = document.createElement('div');
      row.className = 'trace-field';
      const term = document.createElement('dt');
      term.textContent = name;
      const detail = document.createElement('dd');
      detail.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      row.append(term, detail);
      list.append(row);
    }
    fields.append(list);
    finish();
    play();
  }

  replayButton.addEventListener('click', play);
  pauseButton.addEventListener('click', () => {
    if (running) {
      cancelTimer();
      running = false;
      tree.dataset.playback = 'paused';
      syncPlayback();
    } else {
      activate(current, true);
    }
  });
  nextButton.addEventListener('click', () => activate(current + 1, false));
  allButton.addEventListener('click', finish);
  dialog.addEventListener('close', finish);
  clear();
  return { show, clear, play, finish };
}
