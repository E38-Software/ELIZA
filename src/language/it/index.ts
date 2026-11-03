import type { EngineOptions } from '../../core/types';
import { ElizaEngine } from '../../core/ElizaEngine';
import { normalizeInput } from './normalizer';
import { reflectFragment } from './reflections';
import { tokenize } from './tokenizer';
import { italianScript } from './keywords';

export { italianScript } from './keywords';
export {
  italianEmptyInput,
  italianFallback,
  italianNoMatch,
  italianNoMatchByLimit,
  italianRepeat,
} from './fallbacks';

export function createItalianEngine(options?: EngineOptions): ElizaEngine {
  return new ElizaEngine(italianScript, { normalizeInput, tokenize, reflectFragment }, options);
}
