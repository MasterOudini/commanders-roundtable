// `Armored Transport` - a CONTINUOUS prevention effect (CR 615, D385): a `PreventionDef` the
// replacement funnel asks about every damage entry, which absorbs the whole entry and spends
// nothing - the other half of D382 one-shot shield. Generated from one table row.

import { ARMORED_TRANSPORT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ARMORED_TRANSPORT, "Prevent all combat damage that would be dealt to this creature by creatures blocking it.");

export const ARMORED_TRANSPORT_SCRIPT: CardScript = {
  oracleId: ARMORED_TRANSPORT.oracleId,
  name: ARMORED_TRANSPORT.name,
  prevention: [
    {
      abilityId: 'prevent-0',
      text: PRINTED,
      activeZones: ['battlefield'],
      // CR 615 - asked in the funnel per damage entry; a true absorbs the entry whole.
      prevents: (ctx, self, entry, isCombat) => {
        if (!isCombat) return false;
        const tid = entry.target.kind === 'card' ? entry.target.id : null;
        const src = entry.source;
        return (tid === self) && ((ctx.state.combat?.blockers.some((b) => b.card === src && b.attackerOrder.includes(self)) ?? false));
      },
    },
  ],
};
