import type { KeywordCandidate, KeywordRule, Token, TriggerPattern } from './types';

export interface KeywordMatch {
  readonly candidate: KeywordCandidate;
  readonly rule: KeywordRule;
}

export interface KeywordScan {
  readonly clause: readonly Token[];
  readonly stack: readonly KeywordMatch[];
}

function isDelimiter(token: Token): boolean {
  return (
    (token.kind === 'word' && token.normalized === 'ma') ||
    (token.kind === 'punctuation' &&
      (token.normalized === ',' || token.normalized === '…' || /^\.+$/u.test(token.normalized)))
  );
}

function matchesTrigger(words: readonly Token[], start: number, trigger: TriggerPattern): boolean {
  return (
    trigger.tokens.length > 0 &&
    trigger.tokens.every((value, offset) => words[start + offset]?.normalized === value)
  );
}

function scanClause(clause: readonly Token[], rules: readonly KeywordRule[]): KeywordMatch[] {
  const words = clause.filter((token) => token.kind === 'word' || token.kind === 'number');
  const stack: KeywordMatch[] = [];
  let highestPriority = 0;

  for (let position = 0; position < words.length; position += 1) {
    const word = words[position];
    if (!word) continue;

    for (const rule of rules) {
      const trigger = rule.triggers
        .filter((candidate) => matchesTrigger(words, position, candidate))
        .sort((left, right) => right.tokens.length - left.tokens.length)[0];
      if (!trigger) continue;

      const match: KeywordMatch = {
        candidate: {
          keywordId: rule.id,
          priority: rule.priority,
          trigger: trigger.tokens.join(' '),
          position: word.start,
        },
        rule,
      };

      if (rule.priority > highestPriority) {
        highestPriority = rule.priority;
        stack.unshift(match);
      } else {
        stack.push(match);
      }
    }
  }

  return stack;
}

export function scanKeywords(tokens: readonly Token[], rules: readonly KeywordRule[]): KeywordScan {
  const clauses: Token[][] = [[]];

  for (const token of tokens) {
    if (isDelimiter(token)) {
      clauses.push([]);
    } else {
      clauses[clauses.length - 1]?.push(token);
    }
  }

  for (const clause of clauses) {
    const stack = scanClause(clause, rules);
    if (stack.length > 0) return { clause, stack };
  }

  return { clause: clauses[clauses.length - 1] ?? [], stack: [] };
}
