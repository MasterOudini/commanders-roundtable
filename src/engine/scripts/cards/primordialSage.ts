// `Primordial Sage` - a castCreatureSpell trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PRIMORDIAL_SAGE } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(PRIMORDIAL_SAGE, "Whenever you cast a creature spell, you may draw a card.");

export const PRIMORDIAL_SAGE_SCRIPT: CardScript = {
  oracleId: PRIMORDIAL_SAGE.oracleId,
  name: PRIMORDIAL_SAGE.name,
  triggers: [
    {
      abilityId: 'castCreatureSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.includes('Creature'),
      label: () => "Primordial Sage - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
