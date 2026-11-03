import type { FallbackRule } from '../../core/types';

export const italianFallback: FallbackRule = {
  id: 'it-fallback-none',
  replies: [
    'Puoi raccontarmi qualcosa in più?',
    'Che cosa ti viene in mente adesso?',
    'Quale parte vorresti approfondire?',
    'Possiamo restare su questo argomento.',
  ],
};

export const italianNoMatch: FallbackRule = {
  id: 'it-fallback-no-match',
  replies: [
    'Puoi aggiungere qualcosa?',
    'Ti ascolto.',
    'Che cosa intendi con questa parte?',
    'Vuoi provare a dirlo in un altro modo?',
  ],
};

export const italianRepeat: FallbackRule = {
  id: 'it-repeat',
  replies: [
    'Hai scritto: «{{input}}» — che cosa vuoi aggiungere?',
    'Riprendo le parole «{{input}}» — quale aspetto ti interessa?',
    'Hai già detto «{{input}}» — cosa ti fa pensare a questo?',
    'Resto sulle tue parole: «{{input}}» — vuoi continuare?',
  ],
};

export const italianEmptyInput = 'Quando vuoi, puoi scrivere qualcosa.';

export const italianNoMatchByLimit = italianNoMatch.replies;
