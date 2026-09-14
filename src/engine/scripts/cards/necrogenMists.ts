// `Necrogen Mists` - a eachUpkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NECROGEN_MISTS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NECROGEN_MISTS, "At the beginning of each player's upkeep, that player discards a card.");

const VOCAB_L0 = vocabularyEffects("Target player discards a card.", NECROGEN_MISTS.name);
const VOCAB_T_L0 = vocabularyTargets("Target player discards a card.");

export const NECROGEN_MISTS_SCRIPT: CardScript = {
  oracleId: NECROGEN_MISTS.oracleId,
  name: NECROGEN_MISTS.name,
  triggers: [
    {
      abilityId: 'eachUpkeep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      playerOf: (ctx) => ctx.state.turn.activePlayer,
      matches: (_ctx, _self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep',
      label: () => "Necrogen Mists - Target player discards a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'player', id: obj.player }] }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
