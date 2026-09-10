// `Dolmen Gate` - a CONTINUOUS prevention effect (CR 615, D385): a `PreventionDef` the
// replacement funnel asks about every damage entry, which absorbs the whole entry and spends
// nothing - the other half of D382 one-shot shield. Generated from one table row.

import { DOLMEN_GATE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DOLMEN_GATE, "Prevent all combat damage that would be dealt to attacking creatures you control.");

export const DOLMEN_GATE_SCRIPT: CardScript = {
  oracleId: DOLMEN_GATE.oracleId,
  name: DOLMEN_GATE.name,
  prevention: [
    {
      abilityId: 'prevent-0',
      text: PRINTED,
      activeZones: ['battlefield'],
      // CR 615 - asked in the funnel per damage entry; a true absorbs the entry whole.
      prevents: (ctx, self, entry, isCombat) => {
        if (!isCombat) return false;
        const tid = entry.target.kind === 'card' ? entry.target.id : null;
        return (tid !== null && ctx.state.cards[tid]?.controller === ctx.query.controllerOf(self) && ctx.query.isOnBattlefield(tid) && ctx.derive(tid).isCreature && (ctx.state.combat?.attackers.some((a) => a.card === tid) ?? false));
      },
    },
  ],
};
