// `Chimeric Idol` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CHIMERIC_IDOL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CHIMERIC_IDOL, "{0}: Tap all lands you control. This artifact becomes a 3/3 Turtle artifact creature until end of turn.");

const VOCAB_A0 = vocabularyEffects("Tap all lands you control. ~ becomes a 3/3 Turtle artifact creature until end of turn.", CHIMERIC_IDOL.name);
const VOCAB_T_A0 = vocabularyTargets("Tap all lands you control. ~ becomes a 3/3 Turtle artifact creature until end of turn.");

export const CHIMERIC_IDOL_SCRIPT: CardScript = {
  oracleId: CHIMERIC_IDOL.oracleId,
  name: CHIMERIC_IDOL.name,
  activated: [
    {
      ref: `${CHIMERIC_IDOL.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
