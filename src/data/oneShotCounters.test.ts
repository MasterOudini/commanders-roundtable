// D303 - the counter one-shot shape: a few +1/+1 or -1/-1 counters on this
// permanent or on each creature, behind a cost or a library head, is a table row;
// a targeted put (the vocabulary's), an entering object's counter, a charge
// counter and a tail head are not.

import { describe, expect, test } from 'vitest';
import { oneShotCounterShape } from './primitives';

describe('the counter one-shot shape (D303)', () => {
  test('a self or mass counter behind a cost or a library head', () => {
    for (const [line, name] of [
      ['{2}: Put a +1/+1 counter on this creature.', 'X'],
      ['{1}{G}, {T}: Put a +1/+1 counter on Bloodspore Thrinax.', 'Bloodspore Thrinax'],
      ['Whenever this creature attacks, put a +1/+1 counter on it.', 'X'],
      ['When this creature enters, put two +1/+1 counters on it.', 'X'],
      ['Whenever you cast a noncreature spell, put a +1/+1 counter on this creature.', 'X'],
      ['{3}{W}: Put a +1/+1 counter on each creature you control.', 'X'],
      ['Whenever this creature attacks, put a -1/-1 counter on each other creature you control.', 'X'],
      ['When this creature enters, put a +1/+1 counter on each creature.', 'X'],
    ] as const) {
      expect(oneShotCounterShape(line, name), line).toBe(true);
    }
  });

  test('a target, an entering object, a charge counter and a tail head are not', () => {
    expect(oneShotCounterShape('{2}: Put a +1/+1 counter on target creature.', 'X')).toBe(false);
    expect(oneShotCounterShape('Whenever another creature you control enters, put a +1/+1 counter on it.', 'X')).toBe(false);
    expect(oneShotCounterShape('{T}: Put a charge counter on this artifact.', 'X')).toBe(false);
    expect(oneShotCounterShape('Whenever you draw your second card each turn, put a +1/+1 counter on this creature.', 'X')).toBe(false);
    expect(oneShotCounterShape('This creature enters with two +1/+1 counters on it.', 'X')).toBe(false);
  });

  test('the combat-damage-to-a-player and you-gain-life heads read a self counter', () => {
    expect(oneShotCounterShape('Whenever you gain life, put a +1/+1 counter on this creature.', 'X')).toBe(true);
    expect(oneShotCounterShape('Whenever this creature deals combat damage to a player, put a +1/+1 counter on it.', 'X')).toBe(true);
  });
});
