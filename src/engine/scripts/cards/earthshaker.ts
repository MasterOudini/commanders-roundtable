// `Earthshaker` - a castSpiritOrArcane trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EARTHSHAKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EARTHSHAKER, "Whenever you cast a Spirit or Arcane spell, this creature deals 2 damage to each creature without flying.");

const VOCAB_L0 = vocabularyEffects("~ deals 2 damage to each creature without flying.", EARTHSHAKER.name);
const VOCAB_T_L0 = vocabularyTargets("~ deals 2 damage to each creature without flying.");

export const EARTHSHAKER_SCRIPT: CardScript = {
  oracleId: EARTHSHAKER.oracleId,
  name: EARTHSHAKER.name,
  triggers: [
    {
      abilityId: 'castSpiritOrArcane-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.subtypes.some((t) => t === 'Spirit' || t === 'Arcane'),
      label: () => "Earthshaker - ~ deals 2 damage to each creature without flying.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
