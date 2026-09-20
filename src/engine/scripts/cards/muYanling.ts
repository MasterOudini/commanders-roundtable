// `Mu Yanling` - an activation vocab, an activation drawN, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MU_YANLING } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(MU_YANLING, "+2: Target creature can't be blocked this turn.\n−3: Draw two cards.\n−10: Tap all creatures your opponents control. You take an extra turn after this one.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target creature can't be blocked this turn.", MU_YANLING.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature can't be blocked this turn.");
const VOCAB_A2 = vocabularyEffects("Tap all creatures your opponents control. You take an extra turn after this one.", MU_YANLING.name);
const VOCAB_T_A2 = vocabularyTargets("Tap all creatures your opponents control. You take an extra turn after this one.");

export const MU_YANLING_SCRIPT: CardScript = {
  oracleId: MU_YANLING.oracleId,
  name: MU_YANLING.name,
  activated: [
    {
      ref: `${MU_YANLING.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${MU_YANLING.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 2);
      },
    },
    {
      ref: `${MU_YANLING.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A2, VOCAB_T_A2);
      },
    },
  ],
};
