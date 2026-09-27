// `Underworld Rage-Hound` - a static mustAttack
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { UNDERWORLD_RAGE_HOUND } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';

function printed(card: CardData, expected: string): string {
  const actual = card.faces[0]?.oracleText;
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(UNDERWORLD_RAGE_HOUND, "This creature attacks each combat if able.\nEscape—{3}{R}, Exile three other cards from your graveyard. (You may cast this card from your graveyard for its escape cost.)\nThis creature escapes with a +1/+1 counter on it.");
const LINES = PRINTED.split('\n');

export const UNDERWORLD_RAGE_HOUND_SCRIPT: CardScript = {
  oracleId: UNDERWORLD_RAGE_HOUND.oracleId,
  name: UNDERWORLD_RAGE_HOUND.name,
  combat: [
    {
      abilityId: 'mustAttack-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      mustAttack: (_ctx, self, candidate) => candidate === self,
    },
  ],
};
