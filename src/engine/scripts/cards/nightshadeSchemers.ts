// `Nightshade Schemers` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NIGHTSHADE_SCHEMERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NIGHTSHADE_SCHEMERS, "Flying\nKinship — At the beginning of your upkeep, you may look at the top card of your library. If it shares a creature type with this creature, you may reveal it. If you do, each opponent loses 2 life.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Look at the top card of your library. If it shares a creature type with this creature, you may reveal it. If you do, each opponent loses 2 life.", NIGHTSHADE_SCHEMERS.name);
const VOCAB_T_L1 = vocabularyTargets("Look at the top card of your library. If it shares a creature type with this creature, you may reveal it. If you do, each opponent loses 2 life.");

export const NIGHTSHADE_SCHEMERS_SCRIPT: CardScript = {
  oracleId: NIGHTSHADE_SCHEMERS.oracleId,
  name: NIGHTSHADE_SCHEMERS.name,
  triggers: [
    {
      abilityId: 'upkeep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Nightshade Schemers - Look at the top card of your library. If it shares a creature type with this creature, you may reveal it. If you do, each opponent loses 2 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
