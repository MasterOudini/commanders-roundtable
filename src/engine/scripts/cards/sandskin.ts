// `Sandskin` - a CONTINUOUS prevention effect (CR 615, D385): a `PreventionDef` the
// replacement funnel asks about every damage entry, which absorbs the whole entry and spends
// nothing - the other half of D382 one-shot shield. Generated from one table row.

import { SANDSKIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SANDSKIN, "Enchant creature\nPrevent all combat damage that would be dealt to and dealt by enchanted creature.");
const LINES = PRINTED.split(String.fromCharCode(10));

export const SANDSKIN_SCRIPT: CardScript = {
  oracleId: SANDSKIN.oracleId,
  name: SANDSKIN.name,
  prevention: [
    {
      abilityId: 'prevent-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      // CR 615 - asked in the funnel per damage entry; a true absorbs the entry whole.
      prevents: (ctx, self, entry, isCombat) => {
        if (!isCombat) return false;
        const tid = entry.target.kind === 'card' ? entry.target.id : null;
        const src = entry.source;
        return (tid !== null && tid === (ctx.state.cards[self]?.attachedTo ?? null)) || (src === (ctx.state.cards[self]?.attachedTo ?? null));
      },
    },
  ],
};
