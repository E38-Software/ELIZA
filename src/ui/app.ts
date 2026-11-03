import { getSafetyOverride } from '../safety/SafetyOverride';
import { createItalianEngine } from '../language/it';
import type { EngineMode, TraceRecord } from '../core/types';
import { parseUiCommand } from './commands';
import type { UiCommand, UiMode, UiTheme } from './commands';

interface TranscriptEntry {
  readonly role: 'user' | 'assistant' | 'system' | 'safety';
  readonly text: string;
  readonly time: string;
}

interface StoredTrace {
  readonly turn: number;
  readonly record: TraceRecord;
}

const DEFAULT_SEED = 0;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Elemento UI mancante: ${id}`);
  return found as T;
}

function engineMode(mode: UiMode): EngineMode {
  return mode.toLowerCase() as EngineMode;
}

function displayMode(mode: UiMode): string {
  if (mode === 'HISTORICAL') return 'STORICA';
  if (mode === 'DETERMINISTIC') return 'DETERMINISTICA';
  return 'VARIATA';
}

function stringifyTraceValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined) return 'undefined';
  try {
    const serialized = JSON.stringify(value, null, 2);
    return serialized === undefined ? String(value) : serialized;
  } catch {
    return String(value);
  }
}

export function startApplication(): void {
  const form = element<HTMLFormElement>('prompt-form');
  const input = element<HTMLInputElement>('prompt-input');
  const sendButton = element<HTMLButtonElement>('send-button');
  const conversation = element<HTMLOListElement>('conversation');
  const terminalScroll = element<HTMLDivElement>('terminal-scroll');
  const status = element<HTMLParagraphElement>('terminal-status');
  const announcer = element<HTMLDivElement>('announcer');
  const terminal = document.querySelector<HTMLElement>('.terminal-window');
  if (!terminal) throw new Error('Finestra terminale mancante.');
  const terminalElement: HTMLElement = terminal;

  const modeSelect = element<HTMLSelectElement>('mode-select');
  const themeSelect = element<HTMLSelectElement>('theme-select');
  const modeLabel = element<HTMLParagraphElement>('session-mode-label');
  const turnCount = element<HTMLElement>('turn-count');
  const seedValue = element<HTMLElement>('seed-value');
  const traceToggle = element<HTMLInputElement>('trace-toggle');
  const traceDetails = element<HTMLDetailsElement>('trace-details');
  const traceSummary = element<HTMLElement>('trace-summary');
  const traceContent = element<HTMLDivElement>('trace-content');
  const motionToggle = element<HTMLInputElement>('motion-toggle');
  const typingToggle = element<HTMLInputElement>('typing-toggle');
  const announceToggle = element<HTMLInputElement>('announce-toggle');
  const deleteSessionButton = element<HTMLButtonElement>('delete-session-button');
  const speedRange = element<HTMLInputElement>('speed-range');
  const speedValue = element<HTMLOutputElement>('speed-value');
  const textSizeRange = element<HTMLInputElement>('text-size');
  const textSizeValue = element<HTMLOutputElement>('text-size-value');

  const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
  let mode: UiMode = 'HISTORICAL';
  let theme: UiTheme = 'GREEN';
  let seed = DEFAULT_SEED;
  let motionEnabled = !reducedMotion;
  let typingEnabled = !reducedMotion;
  let announceEnabled = true;
  let typingSpeed = 12;
  let turn = 0;
  let traceEnabled = false;
  let busy = true;
  let engine = createItalianEngine({ mode: engineMode(mode), seed });
  const transcript: TranscriptEntry[] = [];
  const traces: StoredTrace[] = [];
  let lastTrace: TraceRecord | null = null;

  function setStatus(message: string): void {
    status.textContent = message;
  }

  function setBusy(value: boolean): void {
    busy = value;
    input.disabled = value;
    sendButton.disabled = value;
    deleteSessionButton.disabled = value;
    form.setAttribute('aria-busy', String(value));
    if (!value) input.focus();
  }

  function appendMessage(
    role: TranscriptEntry['role'],
    text: string,
    animate = false,
  ): Promise<void> {
    const entry: TranscriptEntry = { role, text, time: new Date().toISOString() };
    transcript.push(entry);
    const item = document.createElement('li');
    item.className = `message message-${role}`;

    const label = document.createElement('span');
    label.className = 'message-label';
    label.textContent =
      role === 'user'
        ? 'TU'
        : role === 'safety'
          ? 'NOTA DI SICUREZZA'
          : role === 'system'
            ? 'SISTEMA'
            : 'ELIZA';

    const body = document.createElement('p');
    body.className = 'message-body';
    item.append(label, body);
    conversation.append(item);

    if (animate && typingEnabled && typingSpeed > 0 && motionEnabled) {
      const characters = Array.from(text);
      return new Promise<void>((resolve) => {
        let index = 0;
        const typeNext = (): void => {
          if (!typingEnabled || typingSpeed === 0 || !motionEnabled) {
            body.textContent = text;
            resolve();
            return;
          }
          body.textContent += characters[index] ?? '';
          index += 1;
          terminalScroll.scrollTop = terminalScroll.scrollHeight;
          if (index >= characters.length) {
            resolve();
          } else {
            window.setTimeout(typeNext, typingSpeed);
          }
        };
        typeNext();
      }).then(() => {
        if (role === 'assistant' || role === 'safety') announce(text);
        terminalScroll.scrollTop = terminalScroll.scrollHeight;
      });
    }

    body.textContent = text;
    terminalScroll.scrollTop = terminalScroll.scrollHeight;
    if (role === 'assistant' || role === 'safety') announce(text);
    return Promise.resolve();
  }

  function announce(message: string): void {
    if (announceEnabled) announcer.textContent = message;
  }

  function renderTrace(record: TraceRecord, recordNumber: number): void {
    const fields = Object.entries(record as unknown as Record<string, unknown>);
    traceContent.replaceChildren();
    traceSummary.textContent = `Scambio ${recordNumber} · ${fields.length} campi`;

    if (fields.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'trace-empty';
      empty.textContent = 'Il motore non ha fornito campi di traccia per questo scambio.';
      traceContent.append(empty);
      return;
    }

    const list = document.createElement('dl');
    list.className = 'trace-fields';
    for (const [name, value] of fields) {
      const row = document.createElement('div');
      row.className = 'trace-field';
      const term = document.createElement('dt');
      term.textContent = name;
      const detail = document.createElement('dd');
      detail.textContent = stringifyTraceValue(value);
      row.append(term, detail);
      list.append(row);
    }
    traceContent.append(list);
  }

  function syncControls(): void {
    document.body.dataset.motion = motionEnabled ? 'on' : 'off';
    document.body.dataset.theme = theme.toLowerCase();
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColor) themeColor.content = theme === 'AMBER' ? '#1a0e00' : '#061109';
    terminalElement.dataset.motion = motionEnabled ? 'on' : 'off';
    modeSelect.value = mode;
    themeSelect.value = theme;
    modeLabel.textContent = displayMode(mode);
    turnCount.textContent = String(turn);
    seedValue.textContent = String(seed);
    motionToggle.checked = motionEnabled;
    typingToggle.checked = typingEnabled;
    announceToggle.checked = announceEnabled;
    traceToggle.checked = traceEnabled;
    speedRange.value = String(typingSpeed);
    speedValue.value = `${typingSpeed} ms`;
    textSizeValue.value = `${textSizeRange.value} px`;
  }

  function addTrace(record: TraceRecord): void {
    lastTrace = record;
    traces.push({ turn, record });
    renderTrace(record, turn);
    if (traceEnabled) traceDetails.open = true;
  }

  function exportSession(): void {
    const lines = [
      'ELIZA — ESPORTAZIONE LOCALE',
      `Modalità: ${mode}`,
      `Seed: ${seed}`,
      '',
      'CRONOLOGIA',
    ];
    transcript.forEach((entry) => {
      lines.push(`[${entry.time}] ${entry.role.toUpperCase()}: ${entry.text}`);
    });
    lines.push('', 'TRACCE LOCALI');
    traces.forEach(({ turn: traceTurn, record }) => {
      lines.push(`Scambio ${traceTurn}`);
      for (const [name, value] of Object.entries(record as unknown as Record<string, unknown>)) {
        lines.push(`${name}: ${stringifyTraceValue(value)}`);
      }
      lines.push('');
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `eliza-sessione-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    void appendMessage('system', 'Esportazione richiesta: il file è stato generato localmente.');
  }

  function clearScreen(): void {
    conversation.replaceChildren();
    setStatus('Schermo pulito. Stato e cronologia in memoria sono invariati.');
  }

  async function deleteSession(): Promise<void> {
    const confirmed = window.confirm(
      "Eliminare la cronologia e le tracce conservate in questa scheda? L'azione non può essere annullata.",
    );
    if (!confirmed) {
      await appendMessage('system', 'Eliminazione sessione annullata.');
      return;
    }
    transcript.length = 0;
    traces.length = 0;
    turn = 0;
    traceEnabled = false;
    lastTrace = null;
    mode = 'HISTORICAL';
    seed = DEFAULT_SEED;
    engine = createItalianEngine({ mode: engineMode(mode), seed });
    traceDetails.open = false;
    traceContent.replaceChildren();
    const empty = document.createElement('p');
    empty.className = 'trace-empty';
    empty.textContent =
      'Attiva TRACE ON e invia un messaggio per ispezionare localmente le decisioni del motore.';
    traceContent.append(empty);
    traceSummary.textContent = 'Nessuna traccia disponibile';
    syncControls();
    conversation.replaceChildren();
    announcer.textContent = '';
    input.value = '';
    setStatus('Sessione eliminata. Nuova sessione volatile pronta.');
    await appendMessage('system', 'Sessione eliminata. La nuova sessione è pronta.');
  }

  async function executeCommand(command: UiCommand): Promise<void> {
    switch (command.type) {
      case 'message':
        return;
      case 'help':
        await appendMessage(
          'system',
          'Comandi locali: HELP, ABOUT, CLEAR, RESET, TRACE ON/OFF, MODE HISTORICAL/DETERMINISTIC/VARIED, SEED <uint32>, SPEED <0–80>, THEME GREEN/AMBER, MOTION ON/OFF, EXPORT, DELETE SESSION. Usa * anche come prefisso facoltativo.',
          true,
        );
        return;
      case 'about':
        await appendMessage(
          'system',
          'ELIZA è un esperimento storico basato su regole. Questa interfaccia richiama visivamente il PDP-9, ma non è filologica. La conversazione resta in memoria volatile in questa scheda; niente viene inviato o salvato automaticamente.',
          true,
        );
        return;
      case 'clear':
        clearScreen();
        return;
      case 'reset':
        engine.reset();
        turn = 0;
        lastTrace = null;
        traces.length = 0;
        traceDetails.open = false;
        traceContent.replaceChildren();
        traceSummary.textContent = 'Nessuna traccia disponibile';
        syncControls();
        setStatus('Stato del motore azzerato; modalità e seed invariati.');
        await appendMessage(
          'system',
          'Stato del motore azzerato. La cronologia visibile è conservata.',
        );
        return;
      case 'trace':
        traceEnabled = command.enabled;
        if (!traceEnabled) traceDetails.open = false;
        else if (lastTrace) traceDetails.open = true;
        syncControls();
        await appendMessage(
          'system',
          `Traccia automatica ${traceEnabled ? 'attivata' : 'disattivata'}.`,
        );
        return;
      case 'mode':
        mode = command.mode;
        engine.setMode(engineMode(mode));
        turn = 0;
        lastTrace = null;
        traces.length = 0;
        traceDetails.open = false;
        traceContent.replaceChildren();
        traceSummary.textContent = 'Nessuna traccia disponibile';
        syncControls();
        await appendMessage(
          'system',
          `Modalità ${displayMode(mode)} attiva. Stato del motore reimpostato.`,
        );
        return;
      case 'seed':
        seed = command.seed;
        engine.setSeed(seed);
        turn = 0;
        lastTrace = null;
        traces.length = 0;
        traceDetails.open = false;
        traceContent.replaceChildren();
        traceSummary.textContent = 'Nessuna traccia disponibile';
        syncControls();
        await appendMessage('system', `Seed ${seed} applicato. Stato del motore reimpostato.`);
        return;
      case 'speed':
        typingSpeed = command.milliseconds;
        syncControls();
        await appendMessage(
          'system',
          `Velocità di digitazione impostata a ${typingSpeed} ms per carattere.`,
        );
        return;
      case 'theme':
        theme = command.theme;
        syncControls();
        await appendMessage('system', `Fosfori ${theme === 'AMBER' ? 'ambra' : 'verdi'} attivi.`);
        return;
      case 'motion':
        motionEnabled = command.enabled;
        syncControls();
        await appendMessage(
          'system',
          `Effetti di movimento ${motionEnabled ? 'attivati' : 'disattivati'}.`,
        );
        return;
      case 'export':
        exportSession();
        return;
      case 'delete-session':
        await deleteSession();
        return;
      case 'invalid':
        await appendMessage('system', command.message);
        return;
    }
  }

  async function respondToMessage(text: string): Promise<void> {
    turn += 1;
    turnCount.textContent = String(turn);
    const safetyMatch = getSafetyOverride(text);
    if (safetyMatch) {
      lastTrace = null;
      traceDetails.open = false;
      setStatus(`Percorso safety locale attivato (${safetyMatch.ruleId}); motore non invocato.`);
      await appendMessage('safety', safetyMatch.message, true);
      return;
    }

    const result = engine.respond(text);
    if (traceEnabled) addTrace(result.trace);
    setStatus('Risposta generata dal motore locale a regole.');
    await appendMessage('assistant', result.response, true);
  }

  form.addEventListener('submit', (event: SubmitEvent) => {
    event.preventDefault();
    if (busy) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    setBusy(true);
    void (async () => {
      await appendMessage('user', text);
      const command = parseUiCommand(text);
      if (command.type === 'message') await respondToMessage(text);
      else await executeCommand(command);
      setBusy(false);
    })();
  });

  modeSelect.addEventListener('change', () => {
    const selected = modeSelect.value as UiMode;
    void executeCommand({ type: 'mode', mode: selected });
  });

  themeSelect.addEventListener('change', () => {
    theme = themeSelect.value === 'AMBER' ? 'AMBER' : 'GREEN';
    syncControls();
  });

  traceToggle.addEventListener('change', () => {
    void executeCommand({ type: 'trace', enabled: traceToggle.checked });
  });
  motionToggle.addEventListener('change', () => {
    void executeCommand({ type: 'motion', enabled: motionToggle.checked });
  });
  typingToggle.addEventListener('change', () => {
    typingEnabled = typingToggle.checked;
    syncControls();
  });
  announceToggle.addEventListener('change', () => {
    announceEnabled = announceToggle.checked;
    if (!announceEnabled) announcer.textContent = '';
    syncControls();
  });
  speedRange.addEventListener('input', () => {
    typingSpeed = Number(speedRange.value);
    syncControls();
  });
  textSizeRange.addEventListener('input', () => {
    document.documentElement.style.setProperty('--terminal-font-size', `${textSizeRange.value}px`);
    syncControls();
  });
  element<HTMLButtonElement>('fullscreen-button').addEventListener('click', () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen().catch(() => {
        setStatus('Schermo intero non disponibile in questo browser.');
      });
    }
  });
  deleteSessionButton.addEventListener('click', () => {
    void deleteSession();
  });

  syncControls();
  document.documentElement.style.setProperty('--terminal-font-size', `${textSizeRange.value}px`);
  setBusy(true);

  void (async () => {
    await appendMessage('system', 'INIZIALIZZAZIONE TERMINALE · BUILD LOCALE', true);
    await appendMessage('system', 'MOTORE RULE-DRIVEN · NESSUNA CONNESSIONE REMOTA', true);
    await appendMessage('assistant', 'Ciao. Di cosa vorresti parlare?', true);
    setStatus('Terminale pronto. Digita HELP per i comandi locali.');
    setBusy(false);
  })();
}
