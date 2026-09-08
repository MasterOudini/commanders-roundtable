// `Benthic Infiltrator` - a static cantBeBlocked
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BENTHIC_INFILTRATOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BENTHIC_INFILTRATOR, "Devoid (This card has no color.)\nIngest (Whenever this creature deals combat damage to a player, that player exiles the top card of their library.)\nThis creature can't be blocked.");
const LINES = PRINTED.split('\n');

export const BENTHIC_INFILTRATOR_SCRIPT: CardScript = {
  oracleId: BENTHIC_INFILTRATOR.oracleId,
  name: BENTHIC_INFILTRATOR.name,
  combat: [
    {
      abilityId: 'cantBeBlocked-2',
      text: LINES[2] as string,
      activeZones: ['battlefield'],
      canBlock: (_ctx, self, _blocker, attacker) => attacker !== self,
    },
  ],
};
