// `Incursion Specialist` - a secondSpell trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { INCURSION_SPECIALIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(INCURSION_SPECIALIST, "Whenever you cast your second spell each turn, this creature gets +2/+0 until end of turn and can't be blocked this turn.");

export const INCURSION_SPECIALIST_SCRIPT: CardScript = {
  oracleId: INCURSION_SPECIALIST.oracleId,
  name: INCURSION_SPECIALIST.name,
  triggers: [
    {
      abilityId: 'secondSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && (ctx.state.turn.spellsCast[ev.obj.controller] ?? 0) === 2,
      label: () => "Incursion Specialist - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 0, cantBeBlocked: true }];
      },
    },
  ],
};
