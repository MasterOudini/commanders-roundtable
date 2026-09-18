// `Pacesetter Paragon` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PACESETTER_PARAGON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PACESETTER_PARAGON, "Exhaust — {2}{R}: Put a +1/+1 counter on this creature. It gains double strike until end of turn. (Activate each exhaust ability only once.)");

const VOCAB_A0 = vocabularyEffects("Put a +1/+1 counter on this creature. It gains double strike until end of turn.", PACESETTER_PARAGON.name);
const VOCAB_T_A0 = vocabularyTargets("Put a +1/+1 counter on this creature. It gains double strike until end of turn.");

export const PACESETTER_PARAGON_SCRIPT: CardScript = {
  oracleId: PACESETTER_PARAGON.oracleId,
  name: PACESETTER_PARAGON.name,
  activated: [
    {
      ref: `${PACESETTER_PARAGON.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
