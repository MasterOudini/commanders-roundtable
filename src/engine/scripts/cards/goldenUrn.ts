// `Golden Urn` - a upkeep trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GOLDEN_URN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GOLDEN_URN, "At the beginning of your upkeep, you may put a charge counter on this artifact.\n{T}, Sacrifice this artifact: You gain life equal to the number of charge counters on this artifact.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Put a charge counter on this artifact.", GOLDEN_URN.name);
const VOCAB_T_L0 = vocabularyTargets("Put a charge counter on this artifact.");
const VOCAB_A0 = vocabularyEffects("You gain life equal to the number of charge counters on ~.", GOLDEN_URN.name);
const VOCAB_T_A0 = vocabularyTargets("You gain life equal to the number of charge counters on ~.");

export const GOLDEN_URN_SCRIPT: CardScript = {
  oracleId: GOLDEN_URN.oracleId,
  name: GOLDEN_URN.name,
  activated: [
    {
      ref: `${GOLDEN_URN.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: LINES[0] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Golden Urn - Put a charge counter on this artifact.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
