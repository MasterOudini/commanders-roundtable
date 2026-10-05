// `Felhide Spiritbinder` - a becomesUntapped trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FELHIDE_SPIRITBINDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FELHIDE_SPIRITBINDER, "Inspired — Whenever this creature becomes untapped, you may pay {1}{R}. If you do, create a token that's a copy of another target creature, except it's an enchantment in addition to its other types. It gains haste. Exile it at the beginning of the next end step.");

const VOCAB_L0 = vocabularyEffects("You may pay {1}{R}. If you do, create a token that's a copy of another target creature, except it's an enchantment in addition to its other types. It gains haste. Exile it at the beginning of the next end step.", FELHIDE_SPIRITBINDER.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {1}{R}. If you do, create a token that's a copy of another target creature, except it's an enchantment in addition to its other types. It gains haste. Exile it at the beginning of the next end step.");

export const FELHIDE_SPIRITBINDER_SCRIPT: CardScript = {
  oracleId: FELHIDE_SPIRITBINDER.oracleId,
  name: FELHIDE_SPIRITBINDER.name,
  triggers: [
    {
      abilityId: 'becomesUntapped-0',
      text: PRINTED,
      event: 'PermanentsUntapped',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) => ev.t === 'PermanentsUntapped' && ev.cards.includes(self),
      label: () => "Felhide Spiritbinder - You may pay {1}{R}. If you do, create a token that's a copy of another target creature, except it's an enchantment in addition to its other types. It gains haste. Exile it at the beginning of the next end step.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
