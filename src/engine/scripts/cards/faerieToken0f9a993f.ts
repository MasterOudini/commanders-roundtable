// `Faerie` - a static blocksOnlyFlying
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FAERIE_0F9A993F_TOKEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FAERIE_0F9A993F_TOKEN, "Flying\nThis creature can block only creatures with flying.");
const LINES = PRINTED.split('\n');

export const FAERIE_TOKEN0F9A993F_SCRIPT: CardScript = {
  oracleId: FAERIE_0F9A993F_TOKEN.oracleId,
  name: FAERIE_0F9A993F_TOKEN.name,
  combat: [
    {
      abilityId: 'blocksOnlyFlying-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => blocker !== self || ctx.derive(attacker).keywords.has('flying'),
    },
  ],
};
