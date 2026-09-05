// `Azorius Knight-Arbiter` - a static cantBeBlocked
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AZORIUS_KNIGHT_ARBITER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AZORIUS_KNIGHT_ARBITER, "Vigilance\nThis creature can't be blocked.");
const LINES = PRINTED.split('\n');

export const AZORIUS_KNIGHT_ARBITER_SCRIPT: CardScript = {
  oracleId: AZORIUS_KNIGHT_ARBITER.oracleId,
  name: AZORIUS_KNIGHT_ARBITER.name,
  combat: [
    {
      abilityId: 'cantBeBlocked-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canBlock: (_ctx, self, _blocker, attacker) => attacker !== self,
    },
  ],
};
