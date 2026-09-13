// `Yawgmoth, Thran Physician` - an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { YAWGMOTH_THRAN_PHYSICIAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(YAWGMOTH_THRAN_PHYSICIAN, "Protection from Humans\nPay 1 life, Sacrifice another creature: Put a -1/-1 counter on up to one target creature and draw a card.\n{B}{B}, Discard a card: Proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Put a -1/-1 counter on up to one target creature and draw a card.", YAWGMOTH_THRAN_PHYSICIAN.name);
const VOCAB_T_A0 = vocabularyTargets("Put a -1/-1 counter on up to one target creature and draw a card.");
const VOCAB_A1 = vocabularyEffects("Proliferate.", YAWGMOTH_THRAN_PHYSICIAN.name);
const VOCAB_T_A1 = vocabularyTargets("Proliferate.");

export const YAWGMOTH_THRAN_PHYSICIAN_SCRIPT: CardScript = {
  oracleId: YAWGMOTH_THRAN_PHYSICIAN.oracleId,
  name: YAWGMOTH_THRAN_PHYSICIAN.name,
  activated: [
    {
      ref: `${YAWGMOTH_THRAN_PHYSICIAN.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${YAWGMOTH_THRAN_PHYSICIAN.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
