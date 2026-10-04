// `Stormkeld Vanguard // Bear Down` - a static cantBeBlockedByPower
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STORMKELD_VANGUARD_BEAR_DOWN } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(STORMKELD_VANGUARD_BEAR_DOWN, "This creature can't be blocked by creatures with power 2 or less.\nDestroy target artifact or enchantment. (Then exile this card. You may cast the creature later from exile.)");
const LINES = PRINTED.split('\n');

export const STORMKELD_VANGUARD_BEAR_DOWN_SCRIPT: CardScript = {
  oracleId: STORMKELD_VANGUARD_BEAR_DOWN.oracleId,
  name: STORMKELD_VANGUARD_BEAR_DOWN.name,
  combat: [
    {
      abilityId: 'cantBeBlockedByPower-0', face: 0,
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => attacker !== self || (ctx.derive(blocker).power ?? 0) > 2,
    },
  ],
};
