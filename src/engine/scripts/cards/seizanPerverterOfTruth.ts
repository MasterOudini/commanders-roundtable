// `Seizan, Perverter of Truth` - a eachUpkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SEIZAN_PERVERTER_OF_TRUTH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SEIZAN_PERVERTER_OF_TRUTH, "At the beginning of each player's upkeep, that player loses 2 life and draws two cards.");

const VOCAB_L0 = vocabularyEffects("Target player loses 2 life and draws two cards.", SEIZAN_PERVERTER_OF_TRUTH.name);
const VOCAB_T_L0 = vocabularyTargets("Target player loses 2 life and draws two cards.");

export const SEIZAN_PERVERTER_OF_TRUTH_SCRIPT: CardScript = {
  oracleId: SEIZAN_PERVERTER_OF_TRUTH.oracleId,
  name: SEIZAN_PERVERTER_OF_TRUTH.name,
  triggers: [
    {
      abilityId: 'eachUpkeep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      playerOf: (ctx) => ctx.state.turn.activePlayer,
      matches: (_ctx, _self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep',
      label: () => "Seizan, Perverter of Truth - Target player loses 2 life and draws two cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: VOCAB_T_L0.map(() => ({ kind: 'player' as const, id: obj.player as string })) }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
