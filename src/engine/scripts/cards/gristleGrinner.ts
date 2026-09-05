// `Gristle Grinner` - a aCreatureDies trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GRISTLE_GRINNER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GRISTLE_GRINNER, "Whenever a creature dies, this creature gets +2/+2 until end of turn.");

export const GRISTLE_GRINNER_SCRIPT: CardScript = {
  oracleId: GRISTLE_GRINNER.oracleId,
  name: GRISTLE_GRINNER.name,
  triggers: [
    {
      abilityId: 'aCreatureDies-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, _self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.derive(m.card).typeLine.types.includes('Creature')),
      label: () => "Gristle Grinner - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 2 }];
      },
    },
  ],
};
