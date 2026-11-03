import type { MemoryEntry } from './types';

const HOLL_REPRESENTATION: ReadonlyMap<number, number> = new Map([
  [48, 0],
  [49, 1],
  [50, 2],
  [51, 3],
  [52, 4],
  [53, 5],
  [54, 6],
  [55, 7],
  [56, 8],
  [57, 9],
  [61, 11],
  [39, 12],
  [43, 16],
  [65, 17],
  [66, 18],
  [67, 19],
  [68, 20],
  [69, 21],
  [70, 22],
  [71, 23],
  [72, 24],
  [73, 25],
  [46, 27],
  [41, 28],
  [45, 32],
  [74, 33],
  [75, 34],
  [76, 35],
  [77, 36],
  [78, 37],
  [79, 38],
  [80, 39],
  [81, 40],
  [82, 41],
  [36, 43],
  [42, 44],
  [32, 48],
  [47, 49],
  [83, 50],
  [84, 51],
  [85, 52],
  [86, 53],
  [87, 54],
  [88, 55],
  [89, 56],
  [90, 57],
  [44, 59],
  [40, 60],
]);

const SIX_BIT_BLOCK_SIZE = 6;
const HASH_MAX_BITS = 15;

export function historicalHash(word: string, bits = 2): number {
  if (!Number.isInteger(bits) || bits < 0 || bits > HASH_MAX_BITS) {
    throw new RangeError(`bits must be an integer in [0, ${HASH_MAX_BITS}]`);
  }

  const bytes = new TextEncoder().encode(word);
  const finalBlockStart =
    Math.floor(Math.max(bytes.length - 1, 0) / SIX_BIT_BLOCK_SIZE) * SIX_BIT_BLOCK_SIZE;
  const finalBlock = bytes.slice(finalBlockStart);
  let datum = 0n;

  for (let index = 0; index < SIX_BIT_BLOCK_SIZE; index += 1) {
    const byte = finalBlock[index] ?? 32;
    const hollerith = HOLL_REPRESENTATION.get(byte) ?? byte & 0x3f;
    datum = (datum << 6n) | BigInt(hollerith);
  }

  datum &= (1n << 35n) - 1n;
  const middleSquare = datum * datum;
  const shift = 35 - Math.floor(bits / 2);
  const mask = (1n << BigInt(bits)) - 1n;

  return Number((middleSquare >> BigInt(shift)) & mask);
}

function copyEntry(entry: MemoryEntry): MemoryEntry {
  return Object.freeze({
    text: entry.text,
    source: entry.source,
    ruleId: entry.ruleId,
    createdAt: entry.createdAt,
  });
}

export class MemoryStore {
  private readonly entries: MemoryEntry[] = [];

  enqueue(entry: MemoryEntry): void {
    this.entries.push(copyEntry(entry));
  }

  dequeue(): MemoryEntry | undefined {
    const entry = this.entries.shift();
    return entry === undefined ? undefined : copyEntry(entry);
  }

  clear(): void {
    this.entries.length = 0;
  }

  get size(): number {
    return this.entries.length;
  }

  snapshot(): readonly MemoryEntry[] {
    return Object.freeze(this.entries.map(copyEntry));
  }
}
