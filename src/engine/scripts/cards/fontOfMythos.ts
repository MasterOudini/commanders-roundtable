// `Font of Mythos` - a eachPlayerDrawStep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FONT_OF_MYTHOS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FONT_OF_MYTHOS, "At the beginning of each player's draw step, that player draws two additional cards.");

const VOCAB_L0 = vocabularyEffects("Target player draws two cards.", FONT_OF_MYTHOS.name);
const VOCAB_T_L0 = vocabularyTargets("Target player draws two cards.");

export const FONT_OF_MYTHOS_SCRIPT: CardScript = {
  oracleId: FONT_OF_MYTHOS.oracleId,
  name: FONT_OF_MYTHOS.name,
  triggers: [
    {
      abilityId: 'eachPlayerDrawStep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      playerOf: (ctx) => ctx.state.turn.activePlayer,
      matches: (_ctx, _self, ev) => ev.t === 'StepBegan' && ev.step === 'draw',
      label: () => "Font of Mythos - Target player draws two cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: VOCAB_T_L0.map(() => ({ kind: 'player' as const, id: obj.player as string })) }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
