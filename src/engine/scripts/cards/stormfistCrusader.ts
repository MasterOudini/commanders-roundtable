// `Stormfist Crusader` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STORMFIST_CRUSADER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STORMFIST_CRUSADER, "Menace\nAt the beginning of your upkeep, each player draws a card and loses 1 life.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Each player draws a card and loses 1 life.", STORMFIST_CRUSADER.name);
const VOCAB_T_L1 = vocabularyTargets("Each player draws a card and loses 1 life.");

export const STORMFIST_CRUSADER_SCRIPT: CardScript = {
  oracleId: STORMFIST_CRUSADER.oracleId,
  name: STORMFIST_CRUSADER.name,
  triggers: [
    {
      abilityId: 'upkeep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Stormfist Crusader - Each player draws a card and loses 1 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
