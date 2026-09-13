// `Razortip Whip` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RAZORTIP_WHIP } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RAZORTIP_WHIP, "{1}, {T}: This artifact deals 1 damage to target opponent or planeswalker.");

const VOCAB_A0 = vocabularyEffects("~ deals 1 damage to target opponent or planeswalker.", RAZORTIP_WHIP.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals 1 damage to target opponent or planeswalker.");

export const RAZORTIP_WHIP_SCRIPT: CardScript = {
  oracleId: RAZORTIP_WHIP.oracleId,
  name: RAZORTIP_WHIP.name,
  activated: [
    {
      ref: `${RAZORTIP_WHIP.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
