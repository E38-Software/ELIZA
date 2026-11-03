import type { EngineMode, RandomDraw, RandomSource } from './types';

export interface Selection {
  readonly index: number;
  readonly rotationIndex: number | null;
  readonly randomDraw: RandomDraw | null;
}

export class ResponseSelector {
  private readonly indices: Record<string, number> = Object.create(null) as Record<string, number>;

  constructor(
    private readonly mode: EngineMode,
    private readonly random: RandomSource,
  ) {}

  select(key: string, count: number): Selection {
    if (!Number.isInteger(count) || count < 1) throw new RangeError('No responses available');

    if (this.mode === 'varied') {
      if (count === 1) return { index: 0, rotationIndex: null, randomDraw: null };
      const stateBefore = this.random.state;
      const index = this.random.nextInt(count);
      return {
        index,
        rotationIndex: null,
        randomDraw: {
          purpose: key,
          maxExclusive: count,
          index,
          stateBefore,
          stateAfter: this.random.state,
        },
      };
    }

    const index = (this.indices[key] ?? 0) % count;
    this.indices[key] = (index + 1) % count;
    return { index, rotationIndex: index, randomDraw: null };
  }

  snapshot(): Readonly<Record<string, number>> {
    return { ...this.indices };
  }
}
