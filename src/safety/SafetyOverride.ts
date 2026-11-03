export interface SafetyMatch {
  readonly ruleId: string;
  readonly message: string;
}

const SAFETY_MESSAGE =
  'Se sei in pericolo immediato, chiama il 112 o il numero di emergenza locale e contatta una persona fidata. Questo messaggio non sostituisce l’aiuto di professionisti.';

const RULES: readonly { readonly ruleId: string; readonly pattern: RegExp }[] = [
  {
    ruleId: 'suicidal-intent',
    pattern:
      /\b(?:voglio|vorrei|intendo|ho deciso di|ho intenzione di|penso di|sto pensando di)\s+(?:suicidarmi|uccidermi|ammazzarmi|togliermi la vita|farla finita|morire)\b/,
  },
  {
    ruleId: 'suicidal-intent',
    pattern: /\bmi voglio\s+(?:suicidare|uccidere|ammazzare)\b/,
  },
  {
    ruleId: 'immediate-self-harm',
    pattern:
      /\b(?:mi sto (?:uccidendo|ammazzando|facendo del male|tagliando)|sto per (?:suicidarmi|uccidermi|farmi del male)|mi (?:suicider(?:ò|o)|uccider(?:ò|o)|ammazzer(?:ò|o)|suicido|uccido|ammazzo))(?=$|[^\p{L}\p{N}])/u,
  },
  {
    ruleId: 'recent-attempt',
    pattern: /\bho appena (?:tentato il suicidio|cercato di uccidermi|cercato di suicidarmi)\b/,
  },
  {
    ruleId: 'possible-overdose',
    pattern: /\bho (?:appena )?preso (?:(?:un[' ]?)?overdose|troppe pillole)\b/,
  },
];

const RISK_PATTERNS = RULES.map(({ pattern }) => `(?:${pattern.source})`).join('|');

const NEGATIONS: readonly RegExp[] = [
  /\bnon\s+(?:(?:voglio|vorrei|intendo|penso di|sto pensando di|ho deciso di|ho intenzione di|ho alcuna intenzione di|ho voglia di)\s+)?(?:suicidarmi|uccidermi|ammazzarmi|togliermi la vita|farla finita|morire)\b/,
  new RegExp(`\\bnon\\s+(?:${RISK_PATTERNS})`, 'u'),
  new RegExp(`\\bnon\\s+(?:è|e)\\s+vero\\s+che\\s+(?:${RISK_PATTERNS})`, 'u'),
  /\bnon\s+(?:voglio|vorrei|intendo)\s+(?:né|ne)\s+(?:suicidarmi|uccidermi|ammazzarmi|togliermi la vita|farla finita|morire|farmi del male|tagliarmi)\b/,
  /\bnon\s+mi\s+(?:(?:voglio|vorrei|intendo)\s+)?(?:suicidare|uccidere|ammazzare)\b/,
  /\bnon\s+(?:sto|sono)\s+(?:per\s+)?(?:suicidarmi|uccidermi|ammazzarmi|farmi del male|facendo del male|tagliando)\b/,
  /\bnon\s+(?:(?:voglio|vorrei|intendo)\s+)?(?:farmi del male|tagliarmi|uccidermi|suicidarmi)\b/,
  /\bnon\s+mi\s+(?:sto\s+)?(?:facendo del male|tagliando)\b/,
];

const BARE_ALTERNATIVE =
  /^(?:di\s+)?(?:suicidarmi|uccidermi|ammazzarmi|togliermi la vita|farla finita|morire|farmi del male|tagliarmi)\b/;
const RISK_ALTERNATIVES = [
  ...RULES.map(({ pattern }) => new RegExp(`^(?:${pattern.source})`, pattern.flags)),
  BARE_ALTERNATIVE,
];
const ALTERNATIVE_CONNECTOR = /^\s+(oppure|o|né|ne)\s+(?:che\s+)?/u;

interface TextRange {
  readonly start: number;
  readonly end: number;
}

function normalize(input: string): string {
  return input
    .normalize('NFC')
    .replace(/[‘’ʼ`]/g, "'")
    .toLocaleLowerCase('it-IT')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
}

function negatedRanges(clause: string): readonly TextRange[] {
  const ranges: TextRange[] = [];

  for (const pattern of NEGATIONS) {
    for (const match of clause.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))) {
      const start = match.index ?? 0;
      let end = start + match[0].length;
      const negatedTruth = /^non\s+(?:è|e)\s+vero\s+che\s/u.test(match[0]);

      while (true) {
        const remaining = clause.slice(end);
        const connector = remaining.match(ALTERNATIVE_CONNECTOR);
        if (!connector) break;

        const alternative = remaining.slice(connector[0].length);
        const inScope = negatedTruth || connector[1] === 'né' || connector[1] === 'ne';
        const patterns = inScope ? RISK_ALTERNATIVES : [BARE_ALTERNATIVE];
        const continuation = patterns
          .map((candidate) => alternative.match(candidate))
          .find(Boolean);
        if (!continuation) break;

        end += connector[0].length + continuation[0].length;
      }

      ranges.push({ start, end });
    }
  }

  return ranges;
}

export function getSafetyOverride(input: string): SafetyMatch | null {
  const normalized = normalize(input);
  const clauses = normalized
    .split(
      /[.!?;,\n]+|(?<![\p{L}\p{N}_])(?:ma|però|pero|tuttavia|invece|eppure)(?![\p{L}\p{N}_])|\s+e\s+(?!vero\s+che\b)/u,
    )
    .filter(Boolean);

  for (const clause of clauses) {
    const ranges = negatedRanges(clause);

    for (const rule of RULES) {
      for (const match of clause.matchAll(
        new RegExp(rule.pattern.source, `${rule.pattern.flags}g`),
      )) {
        const start = match.index ?? 0;
        const end = start + match[0].length;
        if (!ranges.some((range) => range.start <= start && end <= range.end)) {
          return { ruleId: rule.ruleId, message: SAFETY_MESSAGE };
        }
      }
    }
  }

  return null;
}
