// `Close Quarters` - a creatureYouControlBecomesBlocked trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CLOSE_QUARTERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CLOSE_QUARTERS, "Whenever a creature you control becomes blocked, this enchantment deals 1 damage to any target.");

const VOCAB_L0 = vocabularyEffects("This enchantment deals 1 damage to any target.", CLOSE_QUARTERS.name);
const VOCAB_T_L0 = vocabularyTargets("This enchantment deals 1 damage to any target.");

export const CLOSE_QUARTERS_SCRIPT: CardScript = {
  oracleId: CLOSE_QUARTERS.oracleId,
  name: CLOSE_QUARTERS.name,
  triggers: [
    {
      abilityId: 'creatureYouControlBecomesBlocked-0',
      text: PRINTED,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => ctx.state.cards[b.attacker]?.controller === ctx.query.controllerOf(self)),
      label: () => "Close Quarters - This enchantment deals 1 damage to any target.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
