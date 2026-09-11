// `Flux Channeler` - a castNoncreature trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FLUX_CHANNELER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FLUX_CHANNELER, "Whenever you cast a noncreature spell, proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)");

const VOCAB_L0 = vocabularyEffects("Proliferate.", FLUX_CHANNELER.name);
const VOCAB_T_L0 = vocabularyTargets("Proliferate.");

export const FLUX_CHANNELER_SCRIPT: CardScript = {
  oracleId: FLUX_CHANNELER.oracleId,
  name: FLUX_CHANNELER.name,
  triggers: [
    {
      abilityId: 'castNoncreature-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && !ctx.derive(ev.obj.card).typeLine.types.includes('Creature'),
      label: () => "Flux Channeler - Proliferate.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
