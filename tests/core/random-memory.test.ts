import { describe, expect, it } from 'vitest';
import { historicalHash, MemoryStore } from '../../src/core/MemoryStore';
import { DeterministicRandom, SeededRandom } from '../../src/core/SeededRandom';
import type { MemoryEntry } from '../../src/core/types';

describe('SeededRandom', () => {
  it('repeats the same sequence for equal seeds and varies across seeds', () => {
    const first = new SeededRandom(123456);
    const sameSeed = new SeededRandom(123456);
    const otherSeed = new SeededRandom(123457);
    const firstValues = Array.from({ length: 8 }, () => first.next());
    const sameSeedValues = Array.from({ length: 8 }, () => sameSeed.next());
    const otherSeedValues = Array.from({ length: 8 }, () => otherSeed.next());

    expect(firstValues).toEqual(sameSeedValues);
    expect(firstValues).not.toEqual(otherSeedValues);
  });

  it('accepts zero as a seed and returns values in [0, 1)', () => {
    const random = new SeededRandom(0);
    const values = Array.from({ length: 100 }, () => random.next());

    expect(random.state).not.toBe(0);
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(new DeterministicRandom().next()).toBe(0);
    expect(new DeterministicRandom().nextInt(10)).toBe(0);
  });

  it('validates seed and integer range arguments', () => {
    expect(() => new SeededRandom(-1)).toThrow(RangeError);
    expect(() => new SeededRandom(1.5)).toThrow(RangeError);
    expect(() => new SeededRandom(0x1_0000_0000)).toThrow(RangeError);
    expect(() => new SeededRandom(1).nextInt(0)).toThrow(RangeError);
    expect(() => new DeterministicRandom().nextInt(1.5)).toThrow(RangeError);
  });

  it('returns integer values within the requested exclusive bound', () => {
    const random = new SeededRandom(42);
    const values = Array.from({ length: 100 }, () => random.nextInt(7));

    expect(values.every((value) => Number.isInteger(value) && value >= 0 && value < 7)).toBe(true);
  });
});

describe('historicalHash', () => {
  it('matches the historical golden vectors', () => {
    expect(historicalHash('HERE', 2)).toBe(3);
    expect(historicalHash('KIDS', 2)).toBe(1);
    expect(historicalHash('TIME', 2)).toBe(0);
    expect(historicalHash('ALWAYS', 7)).toBe(14);
  });

  it('uses the final aligned six-byte block and pads it with spaces', () => {
    expect(historicalHash('INVENTED', 2)).toBe(historicalHash('ED', 2));
    expect(historicalHash('ED', 2)).toBe(historicalHash('ED    ', 2));
    expect(historicalHash('123456ABCDEF', 2)).toBe(historicalHash('ABCDEF', 2));
  });

  it('encodes unknown UTF-8 bytes by their low six bits', () => {
    expect(historicalHash('é', 2)).toBe(historicalHash('3R', 2));
  });

  it('validates the requested number of hash bits', () => {
    expect(historicalHash('HERE', 0)).toBe(0);
    expect(() => historicalHash('HERE', -1)).toThrow(RangeError);
    expect(() => historicalHash('HERE', 16)).toThrow(RangeError);
    expect(() => historicalHash('HERE', 2.5)).toThrow(RangeError);
  });
});

describe('MemoryStore', () => {
  it('dequeues entries in FIFO order and clears the queue', () => {
    const store = new MemoryStore();
    const first: MemoryEntry = { text: 'prima', source: 'MY', ruleId: 'm1', createdAt: 1 };
    const second: MemoryEntry = { text: 'seconda', source: 'YOUR', ruleId: 'm2', createdAt: 2 };

    expect(store.dequeue()).toBeUndefined();
    store.enqueue(first);
    store.enqueue(second);

    expect(store.size).toBe(2);
    expect(store.dequeue()).toEqual(first);
    expect(store.size).toBe(1);
    store.clear();
    expect(store.size).toBe(0);
    expect(store.snapshot()).toEqual([]);
  });

  it('returns defensive copies from enqueue, dequeue, and snapshot', () => {
    const store = new MemoryStore();
    const entry = { text: 'originale', source: 'MY', ruleId: 'm1', createdAt: 1 };
    store.enqueue(entry);
    entry.text = 'modificato dopo enqueue';

    const snapshot = store.snapshot();
    expect(snapshot[0]?.text).toBe('originale');
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot[0])).toBe(true);

    const dequeued = store.dequeue();
    expect(dequeued?.text).toBe('originale');
    expect(dequeued).not.toBe(snapshot[0]);
  });
});
