export type EngineMode = 'historical' | 'deterministic' | 'varied';

export type TokenKind = 'word' | 'number' | 'punctuation' | 'whitespace' | 'symbol';

export interface Token {
  readonly original: string;
  readonly normalized: string;
  readonly kind: TokenKind;
  readonly start: number;
  readonly end: number;
}

export interface TriggerPattern {
  readonly tokens: readonly string[];
}

export type PatternTerm =
  | { readonly kind: 'literal'; readonly value: string }
  | { readonly kind: 'oneOf'; readonly values: readonly string[] }
  | {
      readonly kind: 'wildcard';
      readonly capture: string;
      readonly min?: number;
      readonly max?: number;
    }
  | { readonly kind: 'count'; readonly capture: string; readonly count: number };

export type ReassemblyRule =
  | {
      readonly id: string;
      readonly kind: 'reply';
      readonly template: string;
      readonly reflect?: readonly string[];
      readonly unsafeFallback?: string;
    }
  | { readonly id: string; readonly kind: 'redirect'; readonly target: string }
  | { readonly id: string; readonly kind: 'newkey' };

export interface DecompositionRule {
  readonly id: string;
  readonly pattern: readonly PatternTerm[];
  readonly reassemblies: readonly ReassemblyRule[];
}

export interface MemoryPolicy {
  readonly ruleId: string;
}

export interface KeywordRule {
  readonly id: string;
  readonly priority: number;
  readonly triggers: readonly TriggerPattern[];
  readonly decompositions: readonly DecompositionRule[];
  readonly redirectTo?: string;
  readonly memoryPolicy?: MemoryPolicy;
}

export interface MemoryRule {
  readonly id: string;
  readonly templates: readonly [string, string, string, string];
}

export interface FallbackRule {
  readonly id: string;
  readonly replies: readonly string[];
}

export type ReflectionCategory =
  'pronoun' | 'possessive' | 'verb' | 'clitic' | 'elision' | 'exception';

export interface ReflectionRule {
  readonly from: string;
  readonly to: string;
  readonly category: ReflectionCategory;
}

export interface VerbReflectionRule {
  readonly from: string;
  readonly to: string;
  readonly lemma: string;
  readonly tense: string;
}

export interface ReflectionChange {
  readonly original: string;
  readonly replacement: string;
  readonly category: ReflectionCategory;
}

export interface ReflectionResult {
  readonly text: string;
  readonly changes: readonly ReflectionChange[];
  readonly safe: boolean;
  readonly exceptions: readonly string[];
}

export interface LanguageAdapter {
  readonly normalizeInput: (input: string) => string;
  readonly tokenize: (input: string) => readonly Token[];
  readonly reflectFragment: (input: string) => ReflectionResult;
}

export interface ElizaScript {
  readonly keywords: readonly KeywordRule[];
  readonly fallback: FallbackRule;
  readonly noMatch: FallbackRule;
  readonly repeat: FallbackRule;
  readonly emptyInput: string;
  readonly memoryRules: readonly MemoryRule[];
}

export interface RandomSource {
  next(): number;
  nextInt(maxExclusive: number): number;
  readonly state: number;
}

export interface EngineOptions {
  readonly mode?: EngineMode;
  readonly seed?: number;
}

export interface KeywordCandidate {
  readonly keywordId: string;
  readonly priority: number;
  readonly trigger: string;
  readonly position: number;
}

export interface DecompositionAttempt {
  readonly keywordId: string;
  readonly decompositionId: string;
  readonly matched: boolean;
  readonly captures: Readonly<Record<string, string>>;
}

export interface MemoryEntry {
  readonly text: string;
  readonly source: string;
  readonly ruleId: string;
  readonly createdAt: number;
}

export interface MemoryTrace {
  readonly sizeBefore: number;
  readonly sizeAfter: number;
  readonly created: string | null;
  readonly createdEntries: readonly string[];
  readonly recalled: string | null;
  readonly ruleId: string | null;
  readonly selectionIndex: number | null;
  readonly selectionMethod: 'hash' | 'seeded' | null;
}

export interface RandomDraw {
  readonly purpose: string;
  readonly maxExclusive: number;
  readonly index: number;
  readonly stateBefore: number;
  readonly stateAfter: number;
}

export interface TraceRecord {
  readonly originalInput: string;
  readonly normalizedInput: string;
  readonly tokens: readonly Token[];
  readonly activeClause: string;
  readonly keywords: readonly KeywordCandidate[];
  readonly selectedKeyword: string | null;
  readonly decompositions: readonly DecompositionAttempt[];
  readonly selectedDecomposition: string | null;
  readonly captures: Readonly<Record<string, string>>;
  readonly reflections: readonly ReflectionChange[];
  readonly exceptions: readonly string[];
  readonly reassemblyId: string | null;
  readonly selectionMode: EngineMode;
  readonly rotationIndex: number | null;
  readonly seed: number;
  readonly randomStateBefore: number;
  readonly randomStateAfter: number;
  readonly randomChoice: number | null;
  readonly randomDraws: readonly RandomDraw[];
  readonly limit: number;
  readonly memory: MemoryTrace;
  readonly fallback: string | null;
  readonly repeated: boolean;
  readonly redirectChain: readonly string[];
  readonly response: string;
}

export interface ConversationState {
  readonly mode: EngineMode;
  readonly seed: number;
  readonly randomState: number;
  readonly turn: number;
  readonly limit: number;
  readonly memories: readonly MemoryEntry[];
  readonly reassemblyIndices: Readonly<Record<string, number>>;
  readonly previousInput: string | null;
}

export interface EngineResult {
  readonly response: string;
  readonly trace: TraceRecord;
}
