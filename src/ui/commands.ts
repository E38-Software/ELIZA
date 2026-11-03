export type UiMode = 'HISTORICAL' | 'DETERMINISTIC' | 'VARIED';
export type UiTheme = 'GREEN' | 'AMBER';

export type UiCommand =
  | { readonly type: 'help' }
  | { readonly type: 'about' }
  | { readonly type: 'clear' }
  | { readonly type: 'reset' }
  | { readonly type: 'trace'; readonly enabled: boolean }
  | { readonly type: 'mode'; readonly mode: UiMode }
  | { readonly type: 'seed'; readonly seed: number }
  | { readonly type: 'speed'; readonly milliseconds: number }
  | { readonly type: 'motion'; readonly enabled: boolean }
  | { readonly type: 'theme'; readonly theme: UiTheme }
  | { readonly type: 'export' }
  | { readonly type: 'delete-session' }
  | { readonly type: 'invalid'; readonly message: string }
  | { readonly type: 'message' };

const MAX_SEED = 0xffff_ffff;
const MAX_SPEED = 80;

function invalid(message: string): UiCommand {
  return { type: 'invalid', message };
}

function parseUnsignedInteger(value: string, maximum: number): number | null {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) return null;
  return parsed;
}

function normalizedParts(input: string): readonly string[] {
  const normalized = input.trim().replace(/^\*+/, '').trim();
  return normalized ? normalized.toUpperCase().split(/\s+/) : [];
}

export function parseUiCommand(input: string): UiCommand {
  const parts = normalizedParts(input);
  if (parts.length === 0) return { type: 'message' };

  const [name, argument, ...extra] = parts;
  if (name === undefined) return { type: 'message' };

  if (name === 'HELP' && parts.length === 1) return { type: 'help' };
  if (name === 'ABOUT' && parts.length === 1) return { type: 'about' };
  if (name === 'CLEAR' && parts.length === 1) return { type: 'clear' };
  if (name === 'RESET' && parts.length === 1) return { type: 'reset' };
  if (name === 'EXPORT' && parts.length === 1) return { type: 'export' };
  if (name === 'THEME') {
    if (parts.length === 2 && (argument === 'GREEN' || argument === 'AMBER')) {
      return { type: 'theme', theme: argument };
    }
    return invalid('Uso: THEME GREEN oppure THEME AMBER.');
  }
  if (name === 'DELETE' && parts.length === 2 && argument === 'SESSION') {
    return { type: 'delete-session' };
  }

  if (name === 'TRACE' && extra.length === 0) {
    if (argument === 'ON') return { type: 'trace', enabled: true };
    if (argument === 'OFF') return { type: 'trace', enabled: false };
    if (parts.length === 1) return invalid('Uso: TRACE ON oppure TRACE OFF.');
    if (parts.length === 2) return invalid('TRACE accetta solo ON oppure OFF.');
    return { type: 'message' };
  }
  if (name === 'TRACE') return invalid('Uso: TRACE ON oppure TRACE OFF.');

  if (name === 'MODE' && extra.length === 0) {
    if (argument === 'HISTORICAL' || argument === 'DETERMINISTIC' || argument === 'VARIED') {
      return { type: 'mode', mode: argument };
    }
    if (parts.length === 1) {
      return invalid('Uso: MODE HISTORICAL, MODE DETERMINISTIC oppure MODE VARIED.');
    }
    if (parts.length === 2)
      return invalid('Modalità non riconosciuta. Usa HISTORICAL, DETERMINISTIC o VARIED.');
    return { type: 'message' };
  }
  if (name === 'MODE')
    return invalid('Specifica una sola modalità: HISTORICAL, DETERMINISTIC o VARIED.');

  if (name === 'SEED' && extra.length === 0) {
    if (argument === undefined) return invalid('Uso: SEED <intero da 0 a 4294967295>.');
    const seed = parseUnsignedInteger(argument, MAX_SEED);
    return seed === null
      ? invalid('Il seed deve essere un intero senza segno a 32 bit.')
      : { type: 'seed', seed };
  }
  if (name === 'SEED') return invalid('Uso: SEED <intero da 0 a 4294967295>.');

  if (name === 'SPEED' && extra.length === 0) {
    if (argument === undefined) return invalid('Uso: SPEED <millisecondi da 0 a 80>.');
    const milliseconds = parseUnsignedInteger(argument, MAX_SPEED);
    return milliseconds === null
      ? invalid('La velocità deve essere un intero compreso fra 0 e 80 ms.')
      : { type: 'speed', milliseconds };
  }
  if (name === 'SPEED') return invalid('Uso: SPEED <millisecondi da 0 a 80>.');

  if (name === 'MOTION' && extra.length === 0) {
    if (argument === 'ON') return { type: 'motion', enabled: true };
    if (argument === 'OFF') return { type: 'motion', enabled: false };
    if (parts.length === 1) return invalid('Uso: MOTION ON oppure MOTION OFF.');
    if (parts.length === 2) return invalid('MOTION accetta solo ON oppure OFF.');
    return { type: 'message' };
  }
  if (name === 'MOTION') return invalid('Uso: MOTION ON oppure MOTION OFF.');

  if (name === 'DELETE') return invalid('Uso: DELETE SESSION.');

  return { type: 'message' };
}
