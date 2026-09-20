// `Saiba Trespassers` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SAIBA_TRESPASSERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SAIBA_TRESPASSERS, "Channel — {3}{U}, Discard this card: Tap up to two target creatures you don't control. Those creatures don't untap during their controller's next untap step.");

const VOCAB_A0 = vocabularyEffects("Tap up to two target creatures you don't control. Those creatures don't untap during their controller's next untap step.", SAIBA_TRESPASSERS.name);
const VOCAB_T_A0 = vocabularyTargets("Tap up to two target creatures you don't control. Those creatures don't untap during their controller's next untap step.");

export const SAIBA_TRESPASSERS_SCRIPT: CardScript = {
  oracleId: SAIBA_TRESPASSERS.oracleId,
  name: SAIBA_TRESPASSERS.name,
  activated: [
    {
      ref: `${SAIBA_TRESPASSERS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
