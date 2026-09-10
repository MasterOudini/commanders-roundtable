// `Abyssal Nocturnus` - a opponentDiscards trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ABYSSAL_NOCTURNUS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ABYSSAL_NOCTURNUS, "Whenever an opponent discards a card, this creature gets +2/+2 and gains fear until end of turn. (It can't be blocked except by artifact creatures and/or black creatures.)");

export const ABYSSAL_NOCTURNUS_SCRIPT: CardScript = {
  oracleId: ABYSSAL_NOCTURNUS.oracleId,
  name: ABYSSAL_NOCTURNUS.name,
  triggers: [
    {
      abilityId: 'opponentDiscards-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.reason === 'discard' && m.from.kind === 'hand' && m.from.player !== ctx.query.controllerOf(self),
        ),
      label: () => "Abyssal Nocturnus - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 2, keywords: ["fear"] }];
      },
    },
  ],
};
