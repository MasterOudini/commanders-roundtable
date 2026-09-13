// `Krenko, Mob Boss` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KRENKO_MOB_BOSS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KRENKO_MOB_BOSS, "{T}: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control.");

const VOCAB_A0 = vocabularyEffects("Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control.", KRENKO_MOB_BOSS.name);
const VOCAB_T_A0 = vocabularyTargets("Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control.");

export const KRENKO_MOB_BOSS_SCRIPT: CardScript = {
  oracleId: KRENKO_MOB_BOSS.oracleId,
  name: KRENKO_MOB_BOSS.name,
  activated: [
    {
      ref: `${KRENKO_MOB_BOSS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
