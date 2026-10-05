// `Lotus Blossom` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LOTUS_BLOSSOM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LOTUS_BLOSSOM, "At the beginning of your upkeep, you may put a petal counter on this artifact.\n{T}, Sacrifice this artifact: Add X mana of any one color, where X is the number of petal counters on this artifact.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Put a petal counter on this artifact.", LOTUS_BLOSSOM.name);
const VOCAB_T_L0 = vocabularyTargets("Put a petal counter on this artifact.");

export const LOTUS_BLOSSOM_SCRIPT: CardScript = {
  oracleId: LOTUS_BLOSSOM.oracleId,
  name: LOTUS_BLOSSOM.name,
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: LINES[0] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Lotus Blossom - Put a petal counter on this artifact.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
