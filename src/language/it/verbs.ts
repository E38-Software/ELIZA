import type { VerbReflectionRule } from '../../core/types';

interface VerbFormSet {
  readonly lemma: string;
  readonly tense: string;
  readonly singular: readonly [string, string];
  readonly plural: readonly [string, string];
}

const VERB_FORM_SETS: readonly VerbFormSet[] = [
  { lemma: 'essere', tense: 'present', singular: ['sono', 'sei'], plural: ['siamo', 'siete'] },
  { lemma: 'avere', tense: 'present', singular: ['ho', 'hai'], plural: ['abbiamo', 'avete'] },
  {
    lemma: 'potere',
    tense: 'present',
    singular: ['posso', 'puoi'],
    plural: ['possiamo', 'potete'],
  },
  {
    lemma: 'volere',
    tense: 'present',
    singular: ['voglio', 'vuoi'],
    plural: ['vogliamo', 'volete'],
  },
  { lemma: 'dovere', tense: 'present', singular: ['devo', 'devi'], plural: ['dobbiamo', 'dovete'] },
  {
    lemma: 'pensare',
    tense: 'present',
    singular: ['penso', 'pensi'],
    plural: ['pensiamo', 'pensate'],
  },
  {
    lemma: 'credere',
    tense: 'present',
    singular: ['credo', 'credi'],
    plural: ['crediamo', 'credete'],
  },
  {
    lemma: 'sentire',
    tense: 'present',
    singular: ['sento', 'senti'],
    plural: ['sentiamo', 'sentite'],
  },
  { lemma: 'sapere', tense: 'present', singular: ['so', 'sai'], plural: ['sappiamo', 'sapete'] },
  { lemma: 'vedere', tense: 'present', singular: ['vedo', 'vedi'], plural: ['vediamo', 'vedete'] },
  {
    lemma: 'capire',
    tense: 'present',
    singular: ['capisco', 'capisci'],
    plural: ['capiamo', 'capite'],
  },
  {
    lemma: 'ricordare',
    tense: 'present',
    singular: ['ricordo', 'ricordi'],
    plural: ['ricordiamo', 'ricordate'],
  },
  {
    lemma: 'desiderare',
    tense: 'present',
    singular: ['desidero', 'desideri'],
    plural: ['desideriamo', 'desiderate'],
  },
  { lemma: 'temere', tense: 'present', singular: ['temo', 'temi'], plural: ['temiamo', 'temete'] },
  {
    lemma: 'sperare',
    tense: 'present',
    singular: ['spero', 'speri'],
    plural: ['speriamo', 'sperate'],
  },
  {
    lemma: 'sembrare',
    tense: 'present',
    singular: ['sembro', 'sembri'],
    plural: ['sembriamo', 'sembrate'],
  },
  {
    lemma: 'parlare',
    tense: 'present',
    singular: ['parlo', 'parli'],
    plural: ['parliamo', 'parlate'],
  },
  {
    lemma: 'riuscire',
    tense: 'present',
    singular: ['riesco', 'riesci'],
    plural: ['riusciamo', 'riuscite'],
  },

  { lemma: 'essere', tense: 'imperfect', singular: ['ero', 'eri'], plural: ['eravamo', 'eravate'] },
  {
    lemma: 'avere',
    tense: 'imperfect',
    singular: ['avevo', 'avevi'],
    plural: ['avevamo', 'avevate'],
  },
  {
    lemma: 'potere',
    tense: 'imperfect',
    singular: ['potevo', 'potevi'],
    plural: ['potevamo', 'potevate'],
  },
  {
    lemma: 'volere',
    tense: 'imperfect',
    singular: ['volevo', 'volevi'],
    plural: ['volevamo', 'volevate'],
  },
  {
    lemma: 'dovere',
    tense: 'imperfect',
    singular: ['dovevo', 'dovevi'],
    plural: ['dovevamo', 'dovevate'],
  },
  {
    lemma: 'pensare',
    tense: 'imperfect',
    singular: ['pensavo', 'pensavi'],
    plural: ['pensavamo', 'pensavate'],
  },
  {
    lemma: 'credere',
    tense: 'imperfect',
    singular: ['credevo', 'credevi'],
    plural: ['credevamo', 'credevate'],
  },
  {
    lemma: 'sentire',
    tense: 'imperfect',
    singular: ['sentivo', 'sentivi'],
    plural: ['sentivamo', 'sentivate'],
  },
  {
    lemma: 'sapere',
    tense: 'imperfect',
    singular: ['sapevo', 'sapevi'],
    plural: ['sapevamo', 'sapevate'],
  },
  {
    lemma: 'vedere',
    tense: 'imperfect',
    singular: ['vedevo', 'vedevi'],
    plural: ['vedevamo', 'vedevate'],
  },
  {
    lemma: 'capire',
    tense: 'imperfect',
    singular: ['capivo', 'capivi'],
    plural: ['capivamo', 'capivate'],
  },
  {
    lemma: 'ricordare',
    tense: 'imperfect',
    singular: ['ricordavo', 'ricordavi'],
    plural: ['ricordavamo', 'ricordavate'],
  },
  {
    lemma: 'desiderare',
    tense: 'imperfect',
    singular: ['desideravo', 'desideravi'],
    plural: ['desideravamo', 'desideravate'],
  },
  {
    lemma: 'temere',
    tense: 'imperfect',
    singular: ['temevo', 'temevi'],
    plural: ['temevamo', 'temevate'],
  },
  {
    lemma: 'sperare',
    tense: 'imperfect',
    singular: ['speravo', 'speravi'],
    plural: ['speravamo', 'speravate'],
  },
  {
    lemma: 'sembrare',
    tense: 'imperfect',
    singular: ['sembravo', 'sembravi'],
    plural: ['sembravamo', 'sembravate'],
  },
  {
    lemma: 'parlare',
    tense: 'imperfect',
    singular: ['parlavo', 'parlavi'],
    plural: ['parlavamo', 'parlavate'],
  },
  {
    lemma: 'riuscire',
    tense: 'imperfect',
    singular: ['riuscivo', 'riuscivi'],
    plural: ['riuscivamo', 'riuscivate'],
  },

  { lemma: 'essere', tense: 'future', singular: ['sarò', 'sarai'], plural: ['saremo', 'sarete'] },
  { lemma: 'avere', tense: 'future', singular: ['avrò', 'avrai'], plural: ['avremo', 'avrete'] },
  {
    lemma: 'potere',
    tense: 'future',
    singular: ['potrò', 'potrai'],
    plural: ['potremo', 'potrete'],
  },
  {
    lemma: 'volere',
    tense: 'future',
    singular: ['vorrò', 'vorrai'],
    plural: ['vorremo', 'vorrete'],
  },
  {
    lemma: 'dovere',
    tense: 'future',
    singular: ['dovrò', 'dovrai'],
    plural: ['dovremo', 'dovrete'],
  },
  {
    lemma: 'pensare',
    tense: 'future',
    singular: ['penserò', 'penserai'],
    plural: ['penseremo', 'penserete'],
  },
  {
    lemma: 'credere',
    tense: 'future',
    singular: ['crederò', 'crederai'],
    plural: ['crederemo', 'crederete'],
  },
  {
    lemma: 'sentire',
    tense: 'future',
    singular: ['sentirò', 'sentirai'],
    plural: ['sentiremo', 'sentirete'],
  },
  {
    lemma: 'sapere',
    tense: 'future',
    singular: ['saprò', 'saprai'],
    plural: ['sapremo', 'saprete'],
  },
  {
    lemma: 'vedere',
    tense: 'future',
    singular: ['vedrò', 'vedrai'],
    plural: ['vedremo', 'vedrete'],
  },
  {
    lemma: 'capire',
    tense: 'future',
    singular: ['capirò', 'capirai'],
    plural: ['capiremo', 'capirete'],
  },
  {
    lemma: 'ricordare',
    tense: 'future',
    singular: ['ricorderò', 'ricorderai'],
    plural: ['ricorderemo', 'ricorderete'],
  },
  {
    lemma: 'desiderare',
    tense: 'future',
    singular: ['desidererò', 'desidererai'],
    plural: ['desidereremo', 'desidererete'],
  },
  {
    lemma: 'temere',
    tense: 'future',
    singular: ['temerò', 'temerai'],
    plural: ['temeremo', 'temerete'],
  },
  {
    lemma: 'sperare',
    tense: 'future',
    singular: ['spererò', 'spererai'],
    plural: ['spereremo', 'spererete'],
  },
  {
    lemma: 'sembrare',
    tense: 'future',
    singular: ['sembrerò', 'sembrerai'],
    plural: ['sembreremo', 'sembrerete'],
  },
  {
    lemma: 'parlare',
    tense: 'future',
    singular: ['parlerò', 'parlerai'],
    plural: ['parleremo', 'parlerete'],
  },
  {
    lemma: 'riuscire',
    tense: 'future',
    singular: ['riuscirò', 'riuscirai'],
    plural: ['riusciremo', 'riuscirete'],
  },

  {
    lemma: 'essere',
    tense: 'conditional',
    singular: ['sarei', 'saresti'],
    plural: ['saremmo', 'sareste'],
  },
  {
    lemma: 'avere',
    tense: 'conditional',
    singular: ['avrei', 'avresti'],
    plural: ['avremmo', 'avreste'],
  },
  {
    lemma: 'potere',
    tense: 'conditional',
    singular: ['potrei', 'potresti'],
    plural: ['potremmo', 'potreste'],
  },
  {
    lemma: 'volere',
    tense: 'conditional',
    singular: ['vorrei', 'vorresti'],
    plural: ['vorremmo', 'vorreste'],
  },
  {
    lemma: 'dovere',
    tense: 'conditional',
    singular: ['dovrei', 'dovresti'],
    plural: ['dovremmo', 'dovreste'],
  },
  {
    lemma: 'pensare',
    tense: 'conditional',
    singular: ['penserei', 'penseresti'],
    plural: ['penseremmo', 'pensereste'],
  },
  {
    lemma: 'credere',
    tense: 'conditional',
    singular: ['crederei', 'crederesti'],
    plural: ['crederemmo', 'credereste'],
  },
  {
    lemma: 'sentire',
    tense: 'conditional',
    singular: ['sentirei', 'sentiresti'],
    plural: ['sentiremmo', 'sentireste'],
  },
  {
    lemma: 'sapere',
    tense: 'conditional',
    singular: ['saprei', 'sapresti'],
    plural: ['sapremmo', 'sapreste'],
  },
  {
    lemma: 'vedere',
    tense: 'conditional',
    singular: ['vedrei', 'vedresti'],
    plural: ['vedremmo', 'vedreste'],
  },
  {
    lemma: 'capire',
    tense: 'conditional',
    singular: ['capirei', 'capiresti'],
    plural: ['capiremmo', 'capireste'],
  },
  {
    lemma: 'ricordare',
    tense: 'conditional',
    singular: ['ricorderei', 'ricorderesti'],
    plural: ['ricorderemmo', 'ricordereste'],
  },
  {
    lemma: 'desiderare',
    tense: 'conditional',
    singular: ['desidererei', 'desidereresti'],
    plural: ['desidereremmo', 'desiderereste'],
  },
  {
    lemma: 'temere',
    tense: 'conditional',
    singular: ['temerei', 'temeresti'],
    plural: ['temeremmo', 'temereste'],
  },
  {
    lemma: 'sperare',
    tense: 'conditional',
    singular: ['spererei', 'spereresti'],
    plural: ['spereremmo', 'sperereste'],
  },
  {
    lemma: 'sembrare',
    tense: 'conditional',
    singular: ['sembrerei', 'sembreresti'],
    plural: ['sembreremmo', 'sembrereste'],
  },
  {
    lemma: 'parlare',
    tense: 'conditional',
    singular: ['parlerei', 'parleresti'],
    plural: ['parleremmo', 'parlereste'],
  },
  {
    lemma: 'riuscire',
    tense: 'conditional',
    singular: ['riuscirei', 'riusciresti'],
    plural: ['riusciremmo', 'riuscireste'],
  },
];

const rules: VerbReflectionRule[] = [];

for (const formSet of VERB_FORM_SETS) {
  rules.push(
    {
      from: formSet.singular[0],
      to: formSet.singular[1],
      lemma: formSet.lemma,
      tense: formSet.tense,
    },
    {
      from: formSet.singular[1],
      to: formSet.singular[0],
      lemma: formSet.lemma,
      tense: formSet.tense,
    },
    {
      from: formSet.plural[0],
      to: formSet.plural[1],
      lemma: formSet.lemma,
      tense: formSet.tense,
    },
    {
      from: formSet.plural[1],
      to: formSet.plural[0],
      lemma: formSet.lemma,
      tense: formSet.tense,
    },
  );
}

export const verbReflectionRules: readonly VerbReflectionRule[] = rules;

const ruleByForm = new Map(verbReflectionRules.map((rule) => [rule.from, rule] as const));

export function findVerbReflectionRule(from: string): VerbReflectionRule | undefined {
  return ruleByForm.get(from);
}
