// `Kithkin Zephyrnaut` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KITHKIN_ZEPHYRNAUT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KITHKIN_ZEPHYRNAUT, "Kinship — At the beginning of your upkeep, you may look at the top card of your library. If it shares a creature type with this creature, you may reveal it. If you do, this creature gets +2/+2 and gains flying and vigilance until end of turn.");

const VOCAB_L0 = vocabularyEffects("Look at the top card of your library. If it shares a creature type with this creature, you may reveal it. If you do, this creature gets +2/+2 and gains flying and vigilance until end of turn.", KITHKIN_ZEPHYRNAUT.name);
const VOCAB_T_L0 = vocabularyTargets("Look at the top card of your library. If it shares a creature type with this creature, you may reveal it. If you do, this creature gets +2/+2 and gains flying and vigilance until end of turn.");

export const KITHKIN_ZEPHYRNAUT_SCRIPT: CardScript = {
  oracleId: KITHKIN_ZEPHYRNAUT.oracleId,
  name: KITHKIN_ZEPHYRNAUT.name,
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Kithkin Zephyrnaut - Look at the top card of your library. If it shares a creature type with this creature, you may reveal it. If you do, this creature gets +2/+2 and gains flying and vigilance until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
