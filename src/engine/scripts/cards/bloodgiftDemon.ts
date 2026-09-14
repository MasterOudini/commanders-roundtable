// `Bloodgift Demon` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLOODGIFT_DEMON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLOODGIFT_DEMON, "Flying\nAt the beginning of your upkeep, target player draws a card and loses 1 life.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target player draws a card and loses 1 life.", BLOODGIFT_DEMON.name);
const VOCAB_T_L1 = vocabularyTargets("Target player draws a card and loses 1 life.");

export const BLOODGIFT_DEMON_SCRIPT: CardScript = {
  oracleId: BLOODGIFT_DEMON.oracleId,
  name: BLOODGIFT_DEMON.name,
  triggers: [
    {
      abilityId: 'upkeep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Bloodgift Demon - Target player draws a card and loses 1 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
