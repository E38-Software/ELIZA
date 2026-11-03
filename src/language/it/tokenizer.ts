import type { Token, TokenKind } from '../../core/types';
import { normalizeInput } from './normalizer';

const LETTER_OR_MARK = /^[\p{L}\p{M}]$/u;
const LETTER = /^\p{L}$/u;
const NUMBER = /^\p{N}$/u;
const WHITESPACE = /^\p{White_Space}$/u;
const PUNCTUATION = /^\p{P}$/u;
const SYMBOL_CONTINUATION = /^[\p{S}\p{M}\p{Cf}]$/u;
const APOSTROPHE = /^[\u0027\u2018\u2019\u02BC\uFF07]$/u;

interface CodePoint {
  value: string;
  width: number;
}

function codePointAt(input: string, offset: number): CodePoint {
  const value = String.fromCodePoint(input.codePointAt(offset) as number);
  return { value, width: value.length };
}

function isLetterOrMark(value: string): boolean {
  return LETTER_OR_MARK.test(value);
}

function isApostrophe(value: string): boolean {
  return APOSTROPHE.test(value);
}

function token(input: string, start: number, end: number, kind: TokenKind): Token {
  const original = input.slice(start, end);
  return {
    original,
    normalized: normalizeInput(original),
    kind,
    start,
    end,
  };
}

export function tokenize(input: string): readonly Token[] {
  const tokens: Token[] = [];
  let offset = 0;

  while (offset < input.length) {
    const start = offset;
    const current = codePointAt(input, offset);

    if (WHITESPACE.test(current.value)) {
      offset += current.width;
      while (offset < input.length) {
        const next = codePointAt(input, offset);
        if (!WHITESPACE.test(next.value)) break;
        offset += next.width;
      }
      tokens.push(token(input, start, offset, 'whitespace'));
      continue;
    }

    if (LETTER.test(current.value)) {
      offset += current.width;
      while (offset < input.length) {
        const next = codePointAt(input, offset);
        if (isLetterOrMark(next.value)) {
          offset += next.width;
          continue;
        }

        if (isApostrophe(next.value)) {
          const followingOffset = offset + next.width;
          if (followingOffset < input.length) {
            const following = codePointAt(input, followingOffset);
            if (LETTER.test(following.value)) {
              offset = followingOffset + following.width;
              continue;
            }
          }
        }

        break;
      }
      tokens.push(token(input, start, offset, 'word'));
      continue;
    }

    if (NUMBER.test(current.value)) {
      offset += current.width;
      while (offset < input.length) {
        const next = codePointAt(input, offset);
        if (!NUMBER.test(next.value)) break;
        offset += next.width;
      }
      tokens.push(token(input, start, offset, 'number'));
      continue;
    }

    if (PUNCTUATION.test(current.value)) {
      offset += current.width;
      if (current.value === '.') {
        while (offset < input.length) {
          const next = codePointAt(input, offset);
          if (next.value !== '.') break;
          offset += next.width;
        }
      }
      tokens.push(token(input, start, offset, 'punctuation'));
      continue;
    }

    offset += current.width;
    if (SYMBOL_CONTINUATION.test(current.value)) {
      while (offset < input.length) {
        const next = codePointAt(input, offset);
        if (!SYMBOL_CONTINUATION.test(next.value)) break;
        offset += next.width;
      }
    }
    tokens.push(token(input, start, offset, 'symbol'));
  }

  return tokens;
}
