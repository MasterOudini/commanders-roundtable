// `Halcyon Glaze` - a castCreatureSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HALCYON_GLAZE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HALCYON_GLAZE, "Whenever you cast a creature spell, this enchantment becomes a 4/4 Illusion creature with flying in addition to its other types until end of turn.");

const VOCAB_L0 = vocabularyEffects("This enchantment becomes a 4/4 Illusion creature with flying in addition to its other types until end of turn.", HALCYON_GLAZE.name);
const VOCAB_T_L0 = vocabularyTargets("This enchantment becomes a 4/4 Illusion creature with flying in addition to its other types until end of turn.");

export const HALCYON_GLAZE_SCRIPT: CardScript = {
  oracleId: HALCYON_GLAZE.oracleId,
  name: HALCYON_GLAZE.name,
  triggers: [
    {
      abilityId: 'castCreatureSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.includes('Creature'),
      label: () => "Halcyon Glaze - This enchantment becomes a 4/4 Illusion creature with flying in addition to its other types until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
