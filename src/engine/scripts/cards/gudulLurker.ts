// `Gudul Lurker` - a static cantBeBlocked
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GUDUL_LURKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GUDUL_LURKER, "This creature can't be blocked.\nMegamorph {U} (You may cast this card face down as a 2/2 creature for {3}. Turn it face up any time for its megamorph cost and put a +1/+1 counter on it.)");
const LINES = PRINTED.split('\n');

export const GUDUL_LURKER_SCRIPT: CardScript = {
  oracleId: GUDUL_LURKER.oracleId,
  name: GUDUL_LURKER.name,
  combat: [
    {
      abilityId: 'cantBeBlocked-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      canBlock: (_ctx, self, _blocker, attacker) => attacker !== self,
    },
  ],
};
