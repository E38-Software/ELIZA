import { matchDecomposition } from './DecompositionMatcher';
import { scanKeywords } from './KeywordMatcher';
import { historicalHash, MemoryStore } from './MemoryStore';
import { reassemble } from './ReassemblyEngine';
import { ResponseSelector, type Selection } from './ResponseSelector';
import { SeededRandom } from './SeededRandom';
import type {
  ConversationState,
  DecompositionAttempt,
  ElizaScript,
  EngineMode,
  EngineOptions,
  EngineResult,
  FallbackRule,
  KeywordRule,
  LanguageAdapter,
  RandomDraw,
  ReflectionChange,
  TraceRecord,
} from './types';

const MAX_INPUT_LENGTH = 4096;
const MAX_INPUT_TOKENS = 512;
const MAX_TRANSFORMATIONS = 64;
const DEFAULT_SEED = 1966;

function validMode(mode: EngineMode): boolean {
  return mode === 'historical' || mode === 'deterministic' || mode === 'varied';
}

function validateScript(script: ElizaScript): void {
  const ids = new Set<string>();
  for (const rule of script.keywords) {
    if (ids.has(rule.id)) throw new Error(`Duplicate keyword: ${rule.id}`);
    ids.add(rule.id);
  }
  if (
    script.fallback.replies.length === 0 ||
    script.noMatch.replies.length === 0 ||
    script.repeat.replies.length === 0 ||
    !script.emptyInput.trim()
  ) {
    throw new Error('The script must provide fallback responses');
  }
}

export class ElizaEngine {
  private mode: EngineMode;
  private seed: number;
  private random: SeededRandom;
  private selector: ResponseSelector;
  private memory: MemoryStore;
  private readonly keywords: ReadonlyMap<string, KeywordRule>;
  private turn = 0;
  private limit = 1;
  private previousInput: string | null = null;

  constructor(
    private readonly script: ElizaScript,
    private readonly language: LanguageAdapter,
    options: EngineOptions = {},
  ) {
    validateScript(script);
    this.mode = options.mode ?? 'historical';
    if (!validMode(this.mode)) throw new RangeError('Unknown conversation mode');
    this.seed = options.seed ?? DEFAULT_SEED;
    this.random = new SeededRandom(this.seed);
    this.selector = new ResponseSelector(this.mode, this.random);
    this.memory = new MemoryStore();
    this.keywords = new Map(script.keywords.map((rule) => [rule.id, rule]));
  }

  reset(): void {
    this.random = new SeededRandom(this.seed);
    this.selector = new ResponseSelector(this.mode, this.random);
    this.memory = new MemoryStore();
    this.turn = 0;
    this.limit = 1;
    this.previousInput = null;
  }

  setMode(mode: EngineMode): void {
    if (!validMode(mode)) throw new RangeError('Unknown conversation mode');
    this.mode = mode;
    this.reset();
  }

  setSeed(seed: number): void {
    new SeededRandom(seed);
    this.seed = seed;
    this.reset();
  }

  getState(): ConversationState {
    return {
      mode: this.mode,
      seed: this.seed,
      randomState: this.random.state,
      turn: this.turn,
      limit: this.limit,
      memories: this.memory.snapshot(),
      reassemblyIndices: this.selector.snapshot(),
      previousInput: this.previousInput,
    };
  }

  respond(input: string): EngineResult {
    const exceptions: string[] = [];
    const processedInput = input.slice(0, MAX_INPUT_LENGTH);
    if (processedInput.length !== input.length) {
      exceptions.push(`Input limitato a ${MAX_INPUT_LENGTH} unità UTF-16 per l'elaborazione.`);
    }
    const allTokens = this.language.tokenize(processedInput);
    const tokens = allTokens.slice(0, MAX_INPUT_TOKENS);
    if (tokens.length !== allTokens.length) {
      exceptions.push(`Input limitato a ${MAX_INPUT_TOKENS} token per l'elaborazione.`);
    }

    const normalizedInput = this.language.normalizeInput(input);
    const comparisonInput = normalizedInput.trim().replace(/\s+/gu, ' ');
    const repeated = comparisonInput.length > 0 && comparisonInput === this.previousInput;
    this.previousInput = comparisonInput || null;
    this.turn += 1;
    this.limit = (this.limit % 4) + 1;

    const scan = scanKeywords(tokens, this.script.keywords);
    const activeClause = scan.clause
      .map((token) => token.original)
      .join('')
      .trim();
    const queue = scan.stack.map((match) => match.rule.id);
    const candidates = scan.stack.map((match) => match.candidate);
    const decompositions: DecompositionAttempt[] = [];
    const reflections: ReflectionChange[] = [];
    const randomDraws: RandomDraw[] = [];
    const redirectChain: string[] = [];
    const createdEntries: string[] = [];
    const randomStateBefore = this.random.state;
    const memorySizeBefore = this.memory.size;
    let selectedKeyword: string | null = null;
    let selectedDecomposition: string | null = null;
    let captures: Readonly<Record<string, string>> = {};
    let reassemblyId: string | null = null;
    let rotationIndex: number | null = null;
    let randomChoice: number | null = null;
    let memoryCreated: string | null = null;
    let memoryRecalled: string | null = null;
    let memoryRuleId: string | null = null;
    let memorySelectionIndex: number | null = null;
    let memorySelectionMethod: 'hash' | 'seeded' | null = null;
    let fallback: string | null = null;

    const recordSelection = (selection: Selection): void => {
      rotationIndex = selection.rotationIndex;
      if (selection.randomDraw) {
        randomChoice = selection.index;
        randomDraws.push(selection.randomDraw);
      }
    };

    const finish = (value: string): EngineResult => {
      const response = value.trim() || this.script.emptyInput;
      const trace: TraceRecord = {
        originalInput: input,
        normalizedInput,
        tokens,
        activeClause,
        keywords: candidates,
        selectedKeyword,
        decompositions,
        selectedDecomposition,
        captures,
        reflections,
        exceptions,
        reassemblyId,
        selectionMode: this.mode,
        rotationIndex,
        seed: this.seed,
        randomStateBefore,
        randomStateAfter: this.random.state,
        randomChoice,
        randomDraws,
        limit: this.limit,
        memory: {
          sizeBefore: memorySizeBefore,
          sizeAfter: this.memory.size,
          created: memoryCreated,
          createdEntries,
          recalled: memoryRecalled,
          ruleId: memoryRuleId,
          selectionIndex: memorySelectionIndex,
          selectionMethod: memorySelectionMethod,
        },
        fallback,
        repeated,
        redirectChain,
        response,
      };
      return { response, trace };
    };

    const chooseFallback = (rule: FallbackRule, reason: string): EngineResult => {
      fallback = reason;
      const selection = this.selector.select(`fallback:${rule.id}`, rule.replies.length);
      recordSelection(selection);
      reassemblyId = `${rule.id}:${selection.index}`;
      const response = rule.replies[selection.index] ?? this.script.emptyInput;
      return finish(response.replace(/\{\{input\}\}/gu, () => processedInput.trim()));
    };

    const chooseNoMatch = (): EngineResult => {
      fallback = 'no-match';
      let index = (this.limit - 1) % this.script.noMatch.replies.length;
      if (this.mode === 'varied') {
        const selection = this.selector.select(
          'fallback:no-match',
          this.script.noMatch.replies.length,
        );
        recordSelection(selection);
        index = selection.index;
      }
      reassemblyId = `${this.script.noMatch.id}:${index}`;
      return finish(this.script.noMatch.replies[index] ?? this.script.emptyInput);
    };

    const hasContent = tokens.some(
      (token) => token.kind === 'word' || token.kind === 'number' || token.kind === 'symbol',
    );
    if (!hasContent) {
      fallback = 'empty-input';
      return finish(this.script.emptyInput);
    }

    if (repeated && this.mode !== 'historical') {
      return chooseFallback(this.script.repeat, 'repetition');
    }

    if (queue.length === 0) {
      if (this.limit === 4 && this.memory.size > 0) {
        const entry = this.memory.dequeue();
        if (entry) {
          memoryRecalled = entry.text;
          memoryRuleId = entry.ruleId;
          return finish(entry.text);
        }
      }
      return chooseFallback(this.script.fallback, 'none');
    }

    for (let steps = 0; steps < MAX_TRANSFORMATIONS && queue.length > 0; steps += 1) {
      const keywordId = queue.shift();
      const rule = keywordId === undefined ? undefined : this.keywords.get(keywordId);
      if (!rule) {
        exceptions.push(`Keyword non trovata: ${keywordId ?? ''}`);
        return chooseNoMatch();
      }
      selectedKeyword ??= rule.id;

      if (rule.memoryPolicy) {
        const memoryRule = this.script.memoryRules.find(
          (candidate) => candidate.id === rule.memoryPolicy?.ruleId,
        );
        if (memoryRule) {
          const reflectedClause = this.language.reflectFragment(activeClause);
          reflections.push(...reflectedClause.changes);
          exceptions.push(...reflectedClause.exceptions);
          const hashInput = reflectedClause.safe ? reflectedClause.text : activeClause;
          const hashWords = this.language
            .tokenize(hashInput)
            .filter((token) => token.kind === 'word' || token.kind === 'number');
          const lastWord =
            hashWords[hashWords.length - 1]?.normalized.toLocaleUpperCase('it-IT') ?? '';
          let index: number;
          if (this.mode === 'varied') {
            const stateBefore = this.random.state;
            index = this.random.nextInt(memoryRule.templates.length);
            randomChoice = index;
            randomDraws.push({
              purpose: `memory:${memoryRule.id}`,
              maxExclusive: memoryRule.templates.length,
              index,
              stateBefore,
              stateAfter: this.random.state,
            });
            memorySelectionMethod = 'seeded';
          } else {
            index = historicalHash(lastWord);
            memorySelectionMethod = 'hash';
          }
          const template = memoryRule.templates[index];
          if (template !== undefined) {
            const text = template.replace(/\{\{input\}\}/gu, () => activeClause).trim();
            if (text) {
              this.memory.enqueue({
                text,
                source: activeClause,
                ruleId: memoryRule.id,
                createdAt: this.turn,
              });
              memoryCreated = text;
              createdEntries.push(text);
              memoryRuleId = memoryRule.id;
              memorySelectionIndex = index;
            }
          }
        } else {
          exceptions.push(`Regola di memoria non trovata: ${rule.memoryPolicy.ruleId}`);
        }
      }

      let matched = false;
      for (const decomposition of rule.decompositions) {
        const match = matchDecomposition(decomposition.pattern, scan.clause, processedInput);
        decompositions.push({
          keywordId: rule.id,
          decompositionId: decomposition.id,
          matched: match !== null,
          captures: match ?? {},
        });
        if (match === null) continue;

        matched = true;
        selectedDecomposition = decomposition.id;
        captures = match;
        if (decomposition.reassemblies.length === 0) return chooseNoMatch();

        const selection = this.selector.select(
          `${rule.id}:${decomposition.id}`,
          decomposition.reassemblies.length,
        );
        recordSelection(selection);
        const reassembly = decomposition.reassemblies[selection.index];
        if (!reassembly) return chooseNoMatch();
        reassemblyId = reassembly.id;

        if (reassembly.kind === 'newkey') break;
        if (reassembly.kind === 'redirect') {
          redirectChain.push(reassembly.target);
          queue.unshift(reassembly.target);
          break;
        }

        const assembled = reassemble(reassembly, match, this.language);
        reflections.push(...assembled.changes);
        exceptions.push(...assembled.exceptions);
        if (assembled.usedFallback) fallback = 'safe-language';
        return assembled.text === null ? chooseNoMatch() : finish(assembled.text);
      }

      if (!matched) {
        if (rule.redirectTo) {
          redirectChain.push(rule.redirectTo);
          queue.unshift(rule.redirectTo);
        } else {
          return chooseNoMatch();
        }
      }
    }

    if (queue.length > 0) exceptions.push('Limite dei redirect raggiunto.');
    return chooseFallback(this.script.fallback, 'none');
  }
}
