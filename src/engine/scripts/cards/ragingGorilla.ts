// `Raging Gorilla` - a blocksOrBecomesBlocked trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RAGING_GORILLA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RAGING_GORILLA, "Whenever this creature blocks or becomes blocked, it gets +2/-2 until end of turn.");

export const RAGING_GORILLA_SCRIPT: CardScript = {
  oracleId: RAGING_GORILLA.oracleId,
  name: RAGING_GORILLA.name,
  triggers: [
    {
      abilityId: 'blocksOrBecomesBlocked-0',
      text: PRINTED,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.blocker === self || b.attacker === self),
      label: () => "Raging Gorilla - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: -2 }];
      },
    },
  ],
};
