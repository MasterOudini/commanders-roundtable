// `Furious Assault` - a castCreatureSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FURIOUS_ASSAULT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FURIOUS_ASSAULT, "Whenever you cast a creature spell, this enchantment deals 1 damage to target player or planeswalker.");

const VOCAB_L0 = vocabularyEffects("This enchantment deals 1 damage to target player or planeswalker.", FURIOUS_ASSAULT.name);
const VOCAB_T_L0 = vocabularyTargets("This enchantment deals 1 damage to target player or planeswalker.");

export const FURIOUS_ASSAULT_SCRIPT: CardScript = {
  oracleId: FURIOUS_ASSAULT.oracleId,
  name: FURIOUS_ASSAULT.name,
  triggers: [
    {
      abilityId: 'castCreatureSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.includes('Creature'),
      label: () => "Furious Assault - This enchantment deals 1 damage to target player or planeswalker.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
