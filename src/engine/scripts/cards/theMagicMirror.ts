// `The Magic Mirror` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THE_MAGIC_MIRROR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THE_MAGIC_MIRROR, "This spell costs {1} less to cast for each instant and sorcery card in your graveyard.\nYou have no maximum hand size.\nAt the beginning of your upkeep, put a knowledge counter on The Magic Mirror, then draw a card for each knowledge counter on The Magic Mirror.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Put a knowledge counter on ~, then draw a card for each knowledge counter on ~.", THE_MAGIC_MIRROR.name);
const VOCAB_T_L2 = vocabularyTargets("Put a knowledge counter on ~, then draw a card for each knowledge counter on ~.");

export const THE_MAGIC_MIRROR_SCRIPT: CardScript = {
  oracleId: THE_MAGIC_MIRROR.oracleId,
  name: THE_MAGIC_MIRROR.name,
  triggers: [
    {
      abilityId: 'upkeep-2',
      text: LINES[2] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "The Magic Mirror - Put a knowledge counter on ~, then draw a card for each knowledge counter on ~.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
