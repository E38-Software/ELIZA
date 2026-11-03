import { describe, expect, it, vi } from 'vitest';
import { createItalianEngine } from '../../src/language/it/index';
import { getSafetyOverride } from '../../src/safety/SafetyOverride';

describe('getSafetyOverride: regole esplicite locali, non un classificatore completo', () => {
  it.each([
    ['Ho deciso di togliermi la vita stasera.', 'suicidal-intent'],
    ['Non ce la faccio più, voglio farla finita.', 'suicidal-intent'],
    ['Mi sto facendo del male.', 'immediate-self-harm'],
    ['Mi suiciderò.', 'immediate-self-harm'],
    ['Ho appena tentato il suicidio.', 'recent-attempt'],
    ['Ho preso un’overdose.', 'possible-overdose'],
  ])('riconosce una frase esplicita: %s', (input, ruleId) => {
    const result = getSafetyOverride(input);

    expect(result).not.toBeNull();
    expect(result?.ruleId).toBe(ruleId);
    expect(result?.message).toContain('112');
    expect(result?.message).toContain('persona fidata');
    expect(result?.message).toContain('non sostituisce');
  });

  it.each([
    'Non voglio uccidermi.',
    'Non ho intenzione di suicidarmi.',
    'Non voglio farla finita.',
    'Non è vero che voglio uccidermi.',
    'Non e vero che voglio uccidermi.',
    'Non sto per farmi del male.',
    'Non mi sto facendo del male.',
    'Penso spesso al suicidio nel mio romanzo.',
    'Mi sento triste oggi.',
  ])('non attiva per una negazione o frase non esplicita: %s', (input) => {
    expect(getSafetyOverride(input)).toBeNull();
  });

  it('riconosce gli apostrofi tipografici senza perdere gli accenti', () => {
    expect(getSafetyOverride('Ho preso un’overdose.')?.ruleId).toBe('possible-overdose');
  });

  it.each(['Mi suiciderò.', 'Mi suicidero.', 'Mi suicidero\u0300.'])(
    "riconosce l'alias accentato esplicito: %s",
    (input) => {
      expect(getSafetyOverride(input)?.ruleId).toBe('immediate-self-harm');
    },
  );

  it.each([
    'Non voglio uccidermi, però ho deciso di farla finita.',
    'Non voglio uccidermi, pero ho deciso di farla finita.',
    'Non voglio uccidermi e ho deciso di farla finita.',
    'Non e vero che voglio uccidermi e ho deciso di farla finita.',
  ])('riconosce la frase affermativa dopo il connettivo: %s', (input) => {
    expect(getSafetyOverride(input)?.ruleId).toBe('suicidal-intent');
  });

  it.each([
    'Non voglio uccidermi e non voglio farla finita.',
    'Non e vero che voglio uccidermi e non voglio farla finita.',
  ])('mantiene circoscritta la negazione tra coordinate: %s', (input) => {
    expect(getSafetyOverride(input)).toBeNull();
  });

  it.each([
    ['Non voglio uccidermi eppure ho deciso di farla finita.', 'suicidal-intent'],
    ['Non voglio uccidermi oppure ho deciso di farla finita.', 'suicidal-intent'],
    ['Non voglio uccidermi o ho deciso di farla finita.', 'suicidal-intent'],
    ['Non voglio uccidermi OPPURE ho deciso di farla finita.', 'suicidal-intent'],
    [
      'Non voglio uccidermi oppure non voglio morire o ho deciso di farla finita.',
      'suicidal-intent',
    ],
    ['Non voglio uccidermi o morire oppure ho deciso di farla finita.', 'suicidal-intent'],
    ['Non voglio uccidermi o morire eppure ho deciso di farla finita.', 'suicidal-intent'],
    ['Non è vero che voglio uccidermi eppure ho deciso di farla finita.', 'suicidal-intent'],
    ['Non voglio uccidermi però ho deciso di farla finita.', 'suicidal-intent'],
    ['Ho deciso di farla finita oppure non voglio uccidermi.', 'suicidal-intent'],
    ['Non voglio uccidermi o mi suiciderò.', 'immediate-self-harm'],
    ['Non voglio uccidermi o mi suicidero.', 'immediate-self-harm'],
    ['Non voglio uccidermi oppure ho appena tentato il suicidio.', 'recent-attempt'],
    ['Non voglio uccidermi eppure ho preso un’overdose.', 'possible-overdose'],
    ['Non voglio uccidermi né voglio morire eppure mi suiciderò.', 'immediate-self-harm'],
    ['Non mi suiciderò o ho appena tentato il suicidio.', 'recent-attempt'],
    [
      'Non è vero che voglio uccidermi o che voglio morire, eppure ho deciso di farla finita.',
      'suicidal-intent',
    ],
  ])('riconosce un rischio indipendente dalla negazione: %s', (input, ruleId) => {
    const result = getSafetyOverride(input);

    expect(result?.ruleId).toBe(ruleId);
    expect(result?.message).toBe(getSafetyOverride('Voglio uccidermi.')?.message);
  });

  it.each([
    'Non voglio uccidermi o farla finita.',
    'Non voglio uccidermi oppure suicidarmi.',
    'Non voglio né uccidermi né farla finita.',
    'Non voglio uccidermi né voglio morire.',
    'Non voglio né uccidermi né voglio morire.',
    'Non voglio uccidermi o morire né voglio farla finita.',
    'Non voglio uccidermi o morire né ho intenzione di farla finita.',
    'Non mi suiciderò né mi ucciderò.',
    'Non mi suicidero ne mi uccidero.',
    'Non mi sto uccidendo né mi sto ammazzando.',
    'Non ho preso un’overdose né mi suiciderò.',
    'Non voglio uccidermi eppure non voglio farla finita.',
    'Non voglio uccidermi oppure non voglio farla finita.',
    'Non voglio uccidermi o non voglio farla finita.',
    'Non è vero che voglio uccidermi o voglio farla finita.',
    'Non e vero che voglio uccidermi oppure che ho deciso di farla finita.',
    'Non è vero che voglio uccidermi o suicidarmi oppure che voglio morire.',
    'Non è vero che voglio morire oppure che mi suiciderò.',
    'Non è vero che mi voglio uccidere oppure che mi suiciderò.',
    'Non è vero che voglio uccidermi o che ho deciso di farla finita eppure non voglio morire.',
    'Non è vero che voglio uccidermi né che voglio farla finita.',
    'Non e vero che voglio uccidermi ne che voglio farla finita.',
  ])('non attiva per alternative comprese nella negazione: %s', (input) => {
    expect(getSafetyOverride(input)).toBeNull();
  });

  it("continua a rilevare un'affermazione dopo una negazione", () => {
    expect(getSafetyOverride('Non voglio uccidermi, ma ho deciso di farla finita.')?.ruleId).toBe(
      'suicidal-intent',
    );
  });

  it('non modifica lo stato o le risposte del motore', () => {
    const options = { mode: 'varied', seed: 415 } as const;
    const checked = createItalianEngine(options);
    const control = createItalianEngine(options);
    const inputs = [
      'Io sono triste.',
      'Non voglio uccidermi oppure ho deciso di farla finita.',
      'Non è vero che voglio uccidermi o voglio farla finita.',
      'Boh.',
    ];

    for (const input of inputs) {
      const stateBefore = checked.getState();
      getSafetyOverride(input);
      expect(checked.getState()).toEqual(stateBefore);
      expect(checked.respond(input)).toEqual(control.respond(input));
      expect(checked.getState()).toEqual(control.getState());
    }
  });

  it('non trasmette input o risultati', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    try {
      const input = 'Ho deciso di uccidermi.';
      const firstResult = getSafetyOverride(input);
      const secondResult = getSafetyOverride(input);

      expect(secondResult).toEqual(firstResult);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
