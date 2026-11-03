import { describe, expect, it } from 'vitest';
import { reflectFragment } from '../../src/language/it/reflections';

describe('reflectFragment', () => {
  it('reflects explicit pronouns and preserves surrounding punctuation', () => {
    expect(reflectFragment('Io, tu, me, te; mi e ti; noi e voi!').text).toBe(
      'Tu, io, te, me; ti e mi; voi e noi!',
    );
  });

  it('reflects possessives while retaining grammatical gender and number', () => {
    expect(reflectFragment('mio mia miei mie tuo tua tuoi tue').text).toBe(
      'tuo tua tuoi tue mio mia miei mie',
    );
    expect(reflectFragment('nostro nostra nostri nostre vostro vostra vostri vostre').text).toBe(
      'vostro vostra vostri vostre nostro nostra nostri nostre',
    );
    expect(reflectFragment('suo sua loro').text).toBe('suo sua loro');
  });

  it('reflects listed present, past, future, and conditional verb forms', () => {
    expect(reflectFragment('sono pensi eravamo avreste parlerò riusciresti').text).toBe(
      'sei penso eravate avremmo parlerai riuscirei',
    );
    expect(reflectFragment('Non ho pensato, non ho capito.').text).toBe(
      'Non hai pensato, non hai capito.',
    );
  });

  it('reflects clitics and elisions once, preserving apostrophe style', () => {
    const result = reflectFragment('L’HO, l’hai; sentirmi, vederti, capirmi.');

    expect(result.text).toBe('L’HAI, l’ho; sentirti, vedermi, capirti.');
    expect(result.changes.map(({ category }) => category)).toEqual([
      'elision',
      'elision',
      'clitic',
      'clitic',
      'clitic',
    ]);
  });

  it('does not alter negations, stable contractions, or gendered participles', () => {
    expect(reflectFragment('Non sono stata, tu sei stato. C’è com’è cos’è.').text).toBe(
      'Non sei stata, io sono stato. C’è com’è cos’è.',
    );
  });

  it('marks ambiguous imperatives and ci/vi without inventing a reflection', () => {
    const result = reflectFragment('Dimmi, parlami, spiegami, raccontami: ci vi pensarci.');

    expect(result.text).toBe('Dimmi, parlami, spiegami, raccontami: ci vi pensarci.');
    expect(result.safe).toBe(false);
    expect(result.exceptions).toEqual([
      'Dimmi',
      'parlami',
      'spiegami',
      'raccontami',
      'ci',
      'vi',
      'pensarci',
    ]);
  });

  it('preserves non-reflectible object clitics', () => {
    expect(reflectFragment('lo la li le gli ne parlarne').text).toBe('lo la li le gli ne parlarne');
  });

  it('does not feed replacements back through the reflection tables', () => {
    expect(reflectFragment('io penso che tu pensi; l’ho e l’hai.').text).toBe(
      'tu pensi che io penso; l’hai e l’ho.',
    );
  });
});
