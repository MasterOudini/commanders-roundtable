// `Wake Thrasher` - a becomesUntapped trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WAKE_THRASHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WAKE_THRASHER, "Whenever a permanent you control becomes untapped, this creature gets +1/+1 until end of turn.");

export const WAKE_THRASHER_SCRIPT: CardScript = {
  oracleId: WAKE_THRASHER.oracleId,
  name: WAKE_THRASHER.name,
  triggers: [
    {
      abilityId: 'becomesUntapped-0',
      text: PRINTED,
      event: 'PermanentsUntapped',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'PermanentsUntapped' && ev.cards.some((c) => ctx.state.cards[c]?.controller === ctx.query.controllerOf(self)),
      label: () => "Wake Thrasher - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1 }];
      },
    },
  ],
};
