// `Sythis, Harvest's Hand` - a castSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SYTHIS_HARVEST_S_HAND } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SYTHIS_HARVEST_S_HAND, "Whenever you cast an enchantment spell, you gain 1 life and draw a card.");

const VOCAB_L0 = vocabularyEffects("You gain 1 life and draw a card.", SYTHIS_HARVEST_S_HAND.name);
const VOCAB_T_L0 = vocabularyTargets("You gain 1 life and draw a card.");

export const SYTHIS_HARVESTS_HAND_SCRIPT: CardScript = {
  oracleId: SYTHIS_HARVEST_S_HAND.oracleId,
  name: SYTHIS_HARVEST_S_HAND.name,
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
        ctx.derive(ev.obj.card).typeLine.types.includes('Enchantment'),
      label: () => "Sythis, Harvest's Hand - You gain 1 life and draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
