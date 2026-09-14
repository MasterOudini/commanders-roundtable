// `Dictate of Kruphix` - a eachPlayerDrawStep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DICTATE_OF_KRUPHIX } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DICTATE_OF_KRUPHIX, "Flash (You may cast this spell any time you could cast an instant.)\nAt the beginning of each player's draw step, that player draws an additional card.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target player draws a card.", DICTATE_OF_KRUPHIX.name);
const VOCAB_T_L1 = vocabularyTargets("Target player draws a card.");

export const DICTATE_OF_KRUPHIX_SCRIPT: CardScript = {
  oracleId: DICTATE_OF_KRUPHIX.oracleId,
  name: DICTATE_OF_KRUPHIX.name,
  triggers: [
    {
      abilityId: 'eachPlayerDrawStep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      playerOf: (ctx) => ctx.state.turn.activePlayer,
      matches: (_ctx, _self, ev) => ev.t === 'StepBegan' && ev.step === 'draw',
      label: () => "Dictate of Kruphix - Target player draws a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: VOCAB_T_L1.map(() => ({ kind: 'player' as const, id: obj.player as string })) }, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
