// `Vine Mare` - a static cantBeBlockedBy
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VINE_MARE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VINE_MARE, "Hexproof (This creature can't be the target of spells or abilities your opponents control.)\nThis creature can't be blocked by black creatures.");
const LINES = PRINTED.split('\n');

export const VINE_MARE_SCRIPT: CardScript = {
  oracleId: VINE_MARE.oracleId,
  name: VINE_MARE.name,
  combat: [
    {
      abilityId: 'cantBeBlockedBy-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => attacker !== self || !(ctx.derive(blocker).typeLine.types.includes('Creature') && ctx.derive(blocker).colors.includes('B')),
    },
  ],
};
