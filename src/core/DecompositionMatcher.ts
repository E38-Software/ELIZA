import type { PatternTerm, Token } from './types';

export function matchDecomposition(
  pattern: readonly PatternTerm[],
  tokens: readonly Token[],
  input: string,
): Readonly<Record<string, string>> | null {
  const words = tokens.filter((token) => token.kind === 'word' || token.kind === 'number');
  const failed = new Set<string>();

  function captured(start: number, length: number): string {
    if (length === 0) return '';
    const first = words[start];
    const last = words[start + length - 1];
    return first && last ? input.slice(first.start, last.end).trim() : '';
  }

  function visit(termIndex: number, wordIndex: number): Record<string, string> | null {
    if (termIndex === pattern.length) return wordIndex === words.length ? {} : null;

    const state = `${termIndex}:${wordIndex}`;
    if (failed.has(state)) return null;
    const term = pattern[termIndex];
    const word = words[wordIndex];
    if (!term) return null;

    if (term.kind === 'literal' || term.kind === 'oneOf') {
      const matches =
        word &&
        (term.kind === 'literal'
          ? word.normalized === term.value
          : term.values.includes(word.normalized));
      if (matches) {
        const result = visit(termIndex + 1, wordIndex + 1);
        if (result !== null) return result;
      }
    } else if (term.kind === 'count') {
      if (
        Number.isInteger(term.count) &&
        term.count >= 0 &&
        wordIndex + term.count <= words.length
      ) {
        const result = visit(termIndex + 1, wordIndex + term.count);
        if (result !== null) return { [term.capture]: captured(wordIndex, term.count), ...result };
      }
    } else {
      const minimum = term.min ?? 0;
      const maximum = Math.min(term.max ?? words.length, words.length - wordIndex);
      if (Number.isInteger(minimum) && minimum >= 0 && Number.isInteger(maximum)) {
        for (let length = minimum; length <= maximum; length += 1) {
          const result = visit(termIndex + 1, wordIndex + length);
          if (result !== null) return { [term.capture]: captured(wordIndex, length), ...result };
        }
      }
    }

    failed.add(state);
    return null;
  }

  return visit(0, 0);
}
