// `Gloryscale Viashino` - a castSpell trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GLORYSCALE_VIASHINO } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GLORYSCALE_VIASHINO, "Whenever you cast a multicolored spell, this creature gets +3/+3 until end of turn.");

export const GLORYSCALE_VIASHINO_SCRIPT: CardScript = {
  oracleId: GLORYSCALE_VIASHINO.oracleId,
  name: GLORYSCALE_VIASHINO.name,
  triggers: [
    {
      abilityId: 'castSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller === ctx.query.controllerOf(self) &&
        ctx.derive(ev.obj.card).colors.length >= 2,
      label: () => "Gloryscale Viashino - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 3, toughness: 3 }];
      },
    },
  ],
};
