// `Pyromancer's Assault` - a secondSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PYROMANCER_S_ASSAULT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PYROMANCER_S_ASSAULT, "Whenever you cast your second spell each turn, this enchantment deals 2 damage to any target.");

const VOCAB_L0 = vocabularyEffects("This enchantment deals 2 damage to any target.", PYROMANCER_S_ASSAULT.name);
const VOCAB_T_L0 = vocabularyTargets("This enchantment deals 2 damage to any target.");

export const PYROMANCERS_ASSAULT_SCRIPT: CardScript = {
  oracleId: PYROMANCER_S_ASSAULT.oracleId,
  name: PYROMANCER_S_ASSAULT.name,
  triggers: [
    {
      abilityId: 'secondSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && (ctx.state.turn.spellsCast[ev.obj.controller] ?? 0) === 2,
      label: () => "Pyromancer's Assault - This enchantment deals 2 damage to any target.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
