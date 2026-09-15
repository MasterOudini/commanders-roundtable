// `Ironfist Crusher` - a static blockCapacity
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { IRONFIST_CRUSHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(IRONFIST_CRUSHER, "This creature can block any number of creatures.\nMorph {3}{W} (You may cast this card face down as a 2/2 creature for {3}. Turn it face up any time for its morph cost.)");
const LINES = PRINTED.split('\n');

export const IRONFIST_CRUSHER_SCRIPT: CardScript = {
  oracleId: IRONFIST_CRUSHER.oracleId,
  name: IRONFIST_CRUSHER.name,
  combat: [
    {
      abilityId: 'blockCapacity-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      blockCapacity: (_ctx, self, blocker) => (blocker === self ? Infinity : null),
    },
  ],
};
