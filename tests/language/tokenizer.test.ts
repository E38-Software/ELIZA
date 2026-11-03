import { describe, expect, it } from 'vitest';
import { normalizeInput } from '../../src/language/it/normalizer';
import { tokenize } from '../../src/language/it/tokenizer';

describe('normalizeInput', () => {
  it('normalizes to NFC, lowercases in Italian, and folds typographic apostrophes', () => {
    expect(normalizeInput('PERCHÉ L’HO visto')).toBe("perché l'ho visto");
    expect(normalizeInput('caffe\u0300')).toBe('caffè');
  });
});

describe('tokenize', () => {
  it('keeps Italian elisions within words', () => {
    expect(
      tokenize('l’ho un’intelligenza c’è').map(({ original, kind }) => [original, kind]),
    ).toEqual([
      ['l’ho', 'word'],
      [' ', 'whitespace'],
      ['un’intelligenza', 'word'],
      [' ', 'whitespace'],
      ['c’è', 'word'],
    ]);
  });

  it('preserves accents and normalizes decomposed text without changing source offsets', () => {
    const [word, whitespace, next] = tokenize('CAFFE\u0300  perché');

    expect(word).toMatchObject({
      original: 'CAFFE\u0300',
      normalized: 'caffè',
      kind: 'word',
      start: 0,
      end: 6,
    });
    expect(whitespace).toMatchObject({ start: 6, end: 8, kind: 'whitespace' });
    expect(next).toMatchObject({ original: 'perché', start: 8, end: 14 });
  });

  it('separates punctuation, groups dot sequences, and keeps symbols', () => {
    expect(tokenize('«Ciao…»...🙂').map(({ original, kind }) => [original, kind])).toEqual([
      ['«', 'punctuation'],
      ['Ciao', 'word'],
      ['…', 'punctuation'],
      ['»', 'punctuation'],
      ['...', 'punctuation'],
      ['🙂', 'symbol'],
    ]);
  });

  it('preserves Unicode whitespace, numbers, and UTF-16 offsets', () => {
    const input = '🙂\u00A0C’è\n42!';
    const tokens = tokenize(input);

    expect(tokens.map(({ original, kind, start, end }) => [original, kind, start, end])).toEqual([
      ['🙂', 'symbol', 0, 2],
      ['\u00A0', 'whitespace', 2, 3],
      ['C’è', 'word', 3, 6],
      ['\n', 'whitespace', 6, 7],
      ['42', 'number', 7, 9],
      ['!', 'punctuation', 9, 10],
    ]);
    expect(tokens.map(({ original }) => original).join('')).toBe(input);
  });

  it('returns an empty list for empty input', () => {
    expect(tokenize('')).toEqual([]);
  });
});
