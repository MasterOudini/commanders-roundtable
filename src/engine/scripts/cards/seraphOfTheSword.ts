// `Seraph of the Sword` - a CONTINUOUS prevention effect (CR 615, D385): a `PreventionDef` the
// replacement funnel asks about every damage entry, which absorbs the whole entry and spends
// nothing - the other half of D382 one-shot shield. Generated from one table row.

import { SERAPH_OF_THE_SWORD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SERAPH_OF_THE_SWORD, "Flying\nPrevent all combat damage that would be dealt to this creature.");
const LINES = PRINTED.split(String.fromCharCode(10));

export const SERAPH_OF_THE_SWORD_SCRIPT: CardScript = {
  oracleId: SERAPH_OF_THE_SWORD.oracleId,
  name: SERAPH_OF_THE_SWORD.name,
  prevention: [
    {
      abilityId: 'prevent-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      // CR 615 - asked in the funnel per damage entry; a true absorbs the entry whole.
      prevents: (_ctx, self, entry, isCombat) => {
        if (!isCombat) return false;
        const tid = entry.target.kind === 'card' ? entry.target.id : null;
        return (tid === self);
      },
    },
  ],
};
