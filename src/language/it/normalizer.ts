const TYPOGRAPHIC_APOSTROPHES = /[\u2018\u2019\u02BC\uFF07]/gu;

export function normalizeInput(input: string): string {
  return input
    .normalize('NFC')
    .toLocaleLowerCase('it-IT')
    .normalize('NFC')
    .replace(TYPOGRAPHIC_APOSTROPHES, "'");
}
