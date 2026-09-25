// `Jinxed Idol` - a upkeep trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { JINXED_IDOL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(JINXED_IDOL, "At the beginning of your upkeep, this artifact deals 2 damage to you.\nSacrifice a creature: Target opponent gains control of this artifact.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("This artifact deals 2 damage to you.", JINXED_IDOL.name);
const VOCAB_T_L0 = vocabularyTargets("This artifact deals 2 damage to you.");
const VOCAB_A0 = vocabularyEffects("Target opponent gains control of this artifact.", JINXED_IDOL.name);
const VOCAB_T_A0 = vocabularyTargets("Target opponent gains control of this artifact.");

export const JINXED_IDOL_SCRIPT: CardScript = {
  oracleId: JINXED_IDOL.oracleId,
  name: JINXED_IDOL.name,
  activated: [
    {
      ref: `${JINXED_IDOL.oracleId}#a0`,
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
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Jinxed Idol - This artifact deals 2 damage to you.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
