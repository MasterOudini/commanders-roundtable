// D302 - the triggered one-shot self-pump shape: a library head with a
// "~ / it gets +N/+N / gains <kw> until end of turn" payload is a table row; a
// mass payload (the vocabulary's, D301), a head outside the library and a static
// are not.

import { describe, expect, test } from 'vitest';
import { oneShotTriggerShape } from './primitives';

describe('the triggered one-shot shape (D302)', () => {
  test('the eleven library heads with a self-pump payload', () => {
    for (const [line, name] of [
      ['Whenever this creature attacks, it gets +2/+0 until end of turn.', 'Lurking Nightstalker'],
      ['When this creature enters, it gets +1/+1 until end of turn.', 'X'],
      ['Whenever another creature you control enters, this creature gets +1/+0 until end of turn.', 'Beast-Kin Ranger'],
      ['Whenever a creature you control enters, this creature gains flying until end of turn.', 'X'],
      ['Whenever you cast a noncreature spell, this creature gains indestructible until end of turn.', "Cathar's Companion"],
      ['Whenever you cast an instant or sorcery spell, this creature gets +1/+0 until end of turn.', 'Fire Urchin'],
      ['Whenever Erkenbrand or another Human you control enters, Erkenbrand gets +1/+0 until end of turn.', 'Erkenbrand, Lord of Westfold'],
      ['Whenever you attack, this creature gets +1/+1 until end of turn.', 'X'],
      ['Whenever this creature blocks, it gets +0/+2 until end of turn.', 'X'],
      ['Whenever this creature becomes blocked, it gets +2/+0 and gains trample until end of turn.', 'X'],
      ['Whenever this creature blocks or becomes blocked, it gains first strike until end of turn.', 'X'],
    ] as const) {
      expect(oneShotTriggerShape(line, name), line).toBe(true);
    }
  });

  test('a mass payload, a tail head and a static are not this shape', () => {
    expect(oneShotTriggerShape('Whenever this creature attacks, creatures you control get +1/+1 until end of turn.', 'X')).toBe(false);
    expect(oneShotTriggerShape('Whenever this creature blocks a creature with flying, it gets +1/+1 until end of turn.', 'X')).toBe(false);
    expect(oneShotTriggerShape('Whenever you gain life, this creature gets +1/+1 until end of turn.', 'X')).toBe(false);
    expect(oneShotTriggerShape('Creatures you control have haste.', 'X')).toBe(false);
    expect(oneShotTriggerShape('{R}: This creature gets +1/+0 until end of turn.', 'X')).toBe(false);
  });
});
