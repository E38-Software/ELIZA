import type { RandomSource } from './types';

const UINT32_RANGE = 0x1_0000_0000;
const UINT32_MAX = UINT32_RANGE - 1;

function validateMaxExclusive(maxExclusive: number): void {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > UINT32_RANGE) {
    throw new RangeError('maxExclusive must be an integer in [1, 2^32]');
  }
}

/**
 * Mulberry32 PRNG. The unsigned 32-bit state and each output are reproducible
 * for a given seed; the seed range is [0, 2^32 - 1], including zero.
 */
export class SeededRandom implements RandomSource {
  private currentState: number;

  constructor(seed: number) {
    if (!Number.isInteger(seed) || seed < 0 || seed > UINT32_MAX) {
      throw new RangeError('seed must be an integer in [0, 2^32 - 1]');
    }

    this.currentState = seed;
  }

  get state(): number {
    return this.currentState;
  }

  next(): number {
    return this.nextUint32() / UINT32_RANGE;
  }

  nextInt(maxExclusive: number): number {
    validateMaxExclusive(maxExclusive);
    const acceptedRange = Math.floor(UINT32_RANGE / maxExclusive) * maxExclusive;
    let value = this.nextUint32();

    while (value >= acceptedRange) {
      value = this.nextUint32();
    }

    return value % maxExclusive;
  }

  private nextUint32(): number {
    let value = (this.currentState + 0x6d2b79f5) >>> 0;
    this.currentState = value;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  }
}

export class DeterministicRandom implements RandomSource {
  get state(): number {
    return 0;
  }

  next(): number {
    return 0;
  }

  nextInt(maxExclusive: number): number {
    validateMaxExclusive(maxExclusive);
    return 0;
  }
}
