// `Troll of Khazad-dûm` - a static minBlockers
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TROLL_OF_KHAZAD_D_M } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TROLL_OF_KHAZAD_D_M, "This creature can't be blocked except by three or more creatures.\nSwampcycling {1} ({1}, Discard this card: Search your library for a Swamp card, reveal it, put it into your hand, then shuffle.)");
const LINES = PRINTED.split('\n');

export const TROLL_OF_KHAZAD_DM_SCRIPT: CardScript = {
  oracleId: TROLL_OF_KHAZAD_D_M.oracleId,
  name: TROLL_OF_KHAZAD_D_M.name,
  combat: [
    {
      abilityId: 'minBlockers-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      minBlockers: (_ctx, self, attacker) => (attacker === self ? 3 : null),
    },
  ],
};
