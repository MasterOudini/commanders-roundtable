// `Knowledge and Power` - a youScry trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KNOWLEDGE_AND_POWER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KNOWLEDGE_AND_POWER, "Whenever you scry, you may pay {2}. If you do, this enchantment deals 2 damage to any target.");

const VOCAB_L0 = vocabularyEffects("You may pay {2}. If you do, this enchantment deals 2 damage to any target.", KNOWLEDGE_AND_POWER.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {2}. If you do, this enchantment deals 2 damage to any target.");

export const KNOWLEDGE_AND_POWER_SCRIPT: CardScript = {
  oracleId: KNOWLEDGE_AND_POWER.oracleId,
  name: KNOWLEDGE_AND_POWER.name,
  triggers: [
    {
      abilityId: 'youScry-0',
      text: PRINTED,
      event: 'Scried',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) => ev.t === 'Scried' && ev.player === ctx.query.controllerOf(self),
      label: () => "Knowledge and Power - You may pay {2}. If you do, this enchantment deals 2 damage to any target.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
