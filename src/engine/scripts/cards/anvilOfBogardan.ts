// `Anvil of Bogardan` - a eachPlayerDrawStep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ANVIL_OF_BOGARDAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ANVIL_OF_BOGARDAN, "Players have no maximum hand size.\nAt the beginning of each player's draw step, that player draws an additional card, then discards a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target player draws a card, then discards a card.", ANVIL_OF_BOGARDAN.name);
const VOCAB_T_L1 = vocabularyTargets("Target player draws a card, then discards a card.");

export const ANVIL_OF_BOGARDAN_SCRIPT: CardScript = {
  oracleId: ANVIL_OF_BOGARDAN.oracleId,
  name: ANVIL_OF_BOGARDAN.name,
  triggers: [
    {
      abilityId: 'eachPlayerDrawStep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      playerOf: (ctx) => ctx.state.turn.activePlayer,
      matches: (_ctx, _self, ev) => ev.t === 'StepBegan' && ev.step === 'draw',
      label: () => "Anvil of Bogardan - Target player draws a card, then discards a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: VOCAB_T_L1.map(() => ({ kind: 'player' as const, id: obj.player as string })) }, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
