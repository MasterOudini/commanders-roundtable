// `Invisible Stalker` - a static cantBeBlocked
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { INVISIBLE_STALKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(INVISIBLE_STALKER, "Hexproof (This creature can't be the target of spells or abilities your opponents control.)\nThis creature can't be blocked.");
const LINES = PRINTED.split('\n');

export const INVISIBLE_STALKER_SCRIPT: CardScript = {
  oracleId: INVISIBLE_STALKER.oracleId,
  name: INVISIBLE_STALKER.name,
  combat: [
    {
      abilityId: 'cantBeBlocked-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canBlock: (_ctx, self, _blocker, attacker) => attacker !== self,
    },
  ],
};
