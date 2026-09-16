// `Defender en-Vec` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DEFENDER_EN_VEC } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DEFENDER_EN_VEC, "Fading 4 (This creature enters with four fade counters on it. At the beginning of your upkeep, remove a fade counter from it. If you can't, sacrifice it.)\nRemove a fade counter from this creature: Prevent the next 2 damage that would be dealt to any target this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Prevent the next 2 damage that would be dealt to any target this turn.", DEFENDER_EN_VEC.name);
const VOCAB_T_A0 = vocabularyTargets("Prevent the next 2 damage that would be dealt to any target this turn.");

export const DEFENDER_EN_VEC_SCRIPT: CardScript = {
  oracleId: DEFENDER_EN_VEC.oracleId,
  name: DEFENDER_EN_VEC.name,
  activated: [
    {
      ref: `${DEFENDER_EN_VEC.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
