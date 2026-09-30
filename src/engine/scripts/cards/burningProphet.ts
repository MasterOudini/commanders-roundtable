// `Burning Prophet` - a castNoncreature trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BURNING_PROPHET } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BURNING_PROPHET, "Whenever you cast a noncreature spell, this creature gets +1/+0 until end of turn, then scry 1.");

const VOCAB_L0 = vocabularyEffects("~ gets +1/+0 until end of turn, then scry 1.", BURNING_PROPHET.name);
const VOCAB_T_L0 = vocabularyTargets("~ gets +1/+0 until end of turn, then scry 1.");

export const BURNING_PROPHET_SCRIPT: CardScript = {
  oracleId: BURNING_PROPHET.oracleId,
  name: BURNING_PROPHET.name,
  triggers: [
    {
      abilityId: 'castNoncreature-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && !ctx.derive(ev.obj.card).typeLine.types.includes('Creature'),
      label: () => "Burning Prophet - ~ gets +1/+0 until end of turn, then scry 1.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
