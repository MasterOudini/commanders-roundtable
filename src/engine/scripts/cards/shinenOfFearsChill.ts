// `Shinen of Fear's Chill` - a static cantBlock, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SHINEN_OF_FEAR_S_CHILL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SHINEN_OF_FEAR_S_CHILL, "This creature can't block.\nChannel — {1}{B}, Discard this card: Target creature can't block this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target creature can't block this turn.", SHINEN_OF_FEAR_S_CHILL.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature can't block this turn.");

export const SHINEN_OF_FEARS_CHILL_SCRIPT: CardScript = {
  oracleId: SHINEN_OF_FEAR_S_CHILL.oracleId,
  name: SHINEN_OF_FEAR_S_CHILL.name,
  activated: [
    {
      ref: `${SHINEN_OF_FEAR_S_CHILL.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  combat: [
    {
      abilityId: 'cantBlock-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      canBlock: (_ctx, self, blocker) => blocker !== self,
    },
  ],
};
