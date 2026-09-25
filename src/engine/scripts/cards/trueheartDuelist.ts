// `Trueheart Duelist` - a static blockCapacity
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TRUEHEART_DUELIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TRUEHEART_DUELIST, "This creature can block an additional creature each combat.\nEmbalm {2}{W} ({2}{W}, Exile this card from your graveyard: Create a token that's a copy of it, except it's a white Zombie Human Warrior with no mana cost. Embalm only as a sorcery.)");
const LINES = PRINTED.split('\n');

export const TRUEHEART_DUELIST_SCRIPT: CardScript = {
  oracleId: TRUEHEART_DUELIST.oracleId,
  name: TRUEHEART_DUELIST.name,
  combat: [
    {
      abilityId: 'blockCapacity-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      blockCapacity: (_ctx, self, blocker) => (blocker === self ? 2 : null),
    },
  ],
};
