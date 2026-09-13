// `Searing Meditation` - a youGainLife trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SEARING_MEDITATION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SEARING_MEDITATION, "Whenever you gain life, you may pay {2}. If you do, this enchantment deals 2 damage to any target.");

const VOCAB_L0 = vocabularyEffects("You may pay {2}. If you do, this enchantment deals 2 damage to any target.", SEARING_MEDITATION.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {2}. If you do, this enchantment deals 2 damage to any target.");

export const SEARING_MEDITATION_SCRIPT: CardScript = {
  oracleId: SEARING_MEDITATION.oracleId,
  name: SEARING_MEDITATION.name,
  triggers: [
    {
      abilityId: 'youGainLife-0',
      text: PRINTED,
      event: 'LifeChanged',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) => ev.t === 'LifeChanged' && ev.delta > 0 && ev.player === ctx.query.controllerOf(self),
      label: () => "Searing Meditation - You may pay {2}. If you do, this enchantment deals 2 damage to any target.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
