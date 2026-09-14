// `Kami of the Crescent Moon` - a eachPlayerDrawStep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KAMI_OF_THE_CRESCENT_MOON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KAMI_OF_THE_CRESCENT_MOON, "At the beginning of each player's draw step, that player draws an additional card.");

const VOCAB_L0 = vocabularyEffects("Target player draws a card.", KAMI_OF_THE_CRESCENT_MOON.name);
const VOCAB_T_L0 = vocabularyTargets("Target player draws a card.");

export const KAMI_OF_THE_CRESCENT_MOON_SCRIPT: CardScript = {
  oracleId: KAMI_OF_THE_CRESCENT_MOON.oracleId,
  name: KAMI_OF_THE_CRESCENT_MOON.name,
  triggers: [
    {
      abilityId: 'eachPlayerDrawStep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      playerOf: (ctx) => ctx.state.turn.activePlayer,
      matches: (_ctx, _self, ev) => ev.t === 'StepBegan' && ev.step === 'draw',
      label: () => "Kami of the Crescent Moon - Target player draws a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: VOCAB_T_L0.map(() => ({ kind: 'player' as const, id: obj.player as string })) }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
