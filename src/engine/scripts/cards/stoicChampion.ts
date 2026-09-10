// `Stoic Champion` - a aPlayerCycles trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STOIC_CHAMPION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STOIC_CHAMPION, "Whenever a player cycles a card, this creature gets +2/+2 until end of turn.");

export const STOIC_CHAMPION_SCRIPT: CardScript = {
  oracleId: STOIC_CHAMPION.oracleId,
  name: STOIC_CHAMPION.name,
  triggers: [
    {
      abilityId: 'aPlayerCycles-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, _self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.reason === 'cycling' && m.from.kind === 'hand',
        ),
      label: () => "Stoic Champion - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 2 }];
      },
    },
  ],
};
