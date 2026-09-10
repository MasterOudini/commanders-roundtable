// `Light of Sanction` - a CONTINUOUS prevention effect (CR 615, D385): a `PreventionDef` the
// replacement funnel asks about every damage entry, which absorbs the whole entry and spends
// nothing - the other half of D382 one-shot shield. Generated from one table row.

import { LIGHT_OF_SANCTION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LIGHT_OF_SANCTION, "Prevent all damage that would be dealt to creatures you control by sources you control.");

export const LIGHT_OF_SANCTION_SCRIPT: CardScript = {
  oracleId: LIGHT_OF_SANCTION.oracleId,
  name: LIGHT_OF_SANCTION.name,
  prevention: [
    {
      abilityId: 'prevent-0',
      text: PRINTED,
      activeZones: ['battlefield'],
      // CR 615 - asked in the funnel per damage entry; a true absorbs the entry whole.
      prevents: (ctx, self, entry, _isCombat) => {
        const tid = entry.target.kind === 'card' ? entry.target.id : null;
        const src = entry.source;
        return (tid !== null && ctx.state.cards[tid]?.controller === ctx.query.controllerOf(self) && ctx.query.isOnBattlefield(tid) && ctx.derive(tid).isCreature) && (ctx.state.cards[src]?.controller === ctx.query.controllerOf(self));
      },
    },
  ],
};
