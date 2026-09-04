// D300 - the static seam's classifier half: a pure anthem or keyword grant over a
// scope the row generator understands is `scriptable`; a condition dressed as a
// scope ("Attacking creatures"), a one-shot ("until end of turn") and a
// colourless scope stay where they were.

import { describe, expect, test } from 'vitest';
import { staticRowShape } from './primitives';

describe('the static row shapes (D300)', () => {
  test('grants and anthems over the row scopes are static row shapes', () => {
    for (const text of [
      'Creatures you control have flying.',
      'Other creatures you control have trample.',
      'Sliver creatures you control have haste.',
      'All Sliver creatures have double strike.',
      'Other Warrior creatures you control have vigilance.',
      'Red creatures you control have first strike.',
      'Multicolored creatures you control have deathtouch.',
      'Other permanents you control have indestructible.',
      'All creatures have haste.',
      'Cleric creatures have vigilance.',
      'Creatures you control get +1/+1.',
      'Other Elf creatures you control get +1/+1.',
      'Creatures you control get +1/+1 and have vigilance.',
      'Sliver creatures you control have flying and haste.',
    ]) {
      expect(staticRowShape(text), text).toBe(true);
    }
  });

  test('conditions, one-shots and colourless scopes are not', () => {
    for (const text of [
      'Attacking creatures you control have double strike.',
      'Nontoken creatures you control have flying.',
      'Legendary creatures you control have hexproof.',
      'Creatures you control get +1/+1 until end of turn.',
      'Creatures you control gain flying until end of turn.',
      'Colorless creatures you control have flying.',
      'Creatures you control have flying as long as you control an Island.',
      'Target creature gains flying until end of turn.',
      'Creatures your opponents control get -1/-1.',
      'Commander creatures you control get +1/+1 and have lifelink.',
      'Nonhuman creatures you control have trample.',
    ]) {
      expect(staticRowShape(text), text).toBe(false);
    }
  });
});
