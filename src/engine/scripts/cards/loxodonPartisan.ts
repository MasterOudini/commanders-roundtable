// `Loxodon Partisan` - a attacks trigger battleCry
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LOXODON_PARTISAN } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

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

const PRINTED = printed(LOXODON_PARTISAN, "Battle cry (Whenever this creature attacks, each other attacking creature gets +1/+0 until end of turn.)");

export const LOXODON_PARTISAN_SCRIPT: CardScript = {
  oracleId: LOXODON_PARTISAN.oracleId,
  name: LOXODON_PARTISAN.name,
  triggers: [
    {
      abilityId: 'attacks-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Loxodon Partisan - battleCry",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        // Battle cry (CR 702.92): each other attacking creature gets +1/+0 until end of turn.
        return (ctx.state.combat?.attackers ?? []).filter((a) => a.card !== self).map((a) => ({ t: 'PtModifiedUntilEndOfTurn', card: a.card, power: 1, toughness: 0 }));
      },
    },
  ],
};
