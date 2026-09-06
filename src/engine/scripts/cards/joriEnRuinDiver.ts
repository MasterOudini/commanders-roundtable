// `Jori En, Ruin Diver` - a secondSpell trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { JORI_EN_RUIN_DIVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(JORI_EN_RUIN_DIVER, "Whenever you cast your second spell each turn, draw a card.");

export const JORI_EN_RUIN_DIVER_SCRIPT: CardScript = {
  oracleId: JORI_EN_RUIN_DIVER.oracleId,
  name: JORI_EN_RUIN_DIVER.name,
  triggers: [
    {
      abilityId: 'secondSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && (ctx.state.turn.spellsCast[ev.obj.controller] ?? 0) === 2,
      label: () => "Jori En, Ruin Diver - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
