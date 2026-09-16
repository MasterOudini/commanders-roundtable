// `Drone` - a static blocksOnlyFlying
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DRONE_3FCF8950_TOKEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DRONE_3FCF8950_TOKEN, "Flying\nThis token can block only creatures with flying.");
const LINES = PRINTED.split('\n');

export const DRONE_TOKEN3FCF8950_SCRIPT: CardScript = {
  oracleId: DRONE_3FCF8950_TOKEN.oracleId,
  name: DRONE_3FCF8950_TOKEN.name,
  combat: [
    {
      abilityId: 'blocksOnlyFlying-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => blocker !== self || ctx.derive(attacker).keywords.has('flying'),
    },
  ],
};
