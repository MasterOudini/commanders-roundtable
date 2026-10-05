// `Customs Depot` - a castCreatureSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CUSTOMS_DEPOT } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(CUSTOMS_DEPOT, "Whenever you cast a creature spell, you may pay {1}. If you do, draw a card, then discard a card.");

const VOCAB_L0 = vocabularyEffects("You may pay {1}. If you do, draw a card, then discard a card.", CUSTOMS_DEPOT.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {1}. If you do, draw a card, then discard a card.");

export const CUSTOMS_DEPOT_SCRIPT: CardScript = {
  oracleId: CUSTOMS_DEPOT.oracleId,
  name: CUSTOMS_DEPOT.name,
  triggers: [
    {
      abilityId: 'castCreatureSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.includes('Creature'),
      label: () => "Customs Depot - You may pay {1}. If you do, draw a card, then discard a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
