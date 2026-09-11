// `Elusive Spellfist` - a castNoncreature trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ELUSIVE_SPELLFIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ELUSIVE_SPELLFIST, "Whenever you cast a noncreature spell, this creature gets +1/+0 until end of turn and can't be blocked this turn.");

export const ELUSIVE_SPELLFIST_SCRIPT: CardScript = {
  oracleId: ELUSIVE_SPELLFIST.oracleId,
  name: ELUSIVE_SPELLFIST.name,
  triggers: [
    {
      abilityId: 'castNoncreature-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && !ctx.derive(ev.obj.card).typeLine.types.includes('Creature'),
      label: () => "Elusive Spellfist - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0, cantBeBlocked: true }];
      },
    },
  ],
};
