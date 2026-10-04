// `Arashi, the Sky Asunder` - an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ARASHI_THE_SKY_ASUNDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ARASHI_THE_SKY_ASUNDER, "{X}{G}, {T}: Arashi deals X damage to target creature with flying.\nChannel — {X}{G}{G}, Discard this card: It deals X damage to each creature with flying.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ deals X damage to target creature with flying.", ARASHI_THE_SKY_ASUNDER.name, { xCost: true });
const VOCAB_T_A0 = vocabularyTargets("~ deals X damage to target creature with flying.");
const VOCAB_A1 = vocabularyEffects("It deals X damage to each creature with flying.", ARASHI_THE_SKY_ASUNDER.name, { xCost: true });
const VOCAB_T_A1 = vocabularyTargets("It deals X damage to each creature with flying.");

export const ARASHI_THE_SKY_ASUNDER_SCRIPT: CardScript = {
  oracleId: ARASHI_THE_SKY_ASUNDER.oracleId,
  name: ARASHI_THE_SKY_ASUNDER.name,
  activated: [
    {
      ref: `${ARASHI_THE_SKY_ASUNDER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${ARASHI_THE_SKY_ASUNDER.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
