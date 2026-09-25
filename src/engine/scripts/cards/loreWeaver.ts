// `Lore Weaver` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LORE_WEAVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LORE_WEAVER, "Partner with Ley Weaver (When this creature enters, target player may put Ley Weaver into their hand from their library, then shuffle.)\n{5}{U}{U}: Target player draws two cards.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target player draws two cards.", LORE_WEAVER.name);
const VOCAB_T_A0 = vocabularyTargets("Target player draws two cards.");

export const LORE_WEAVER_SCRIPT: CardScript = {
  oracleId: LORE_WEAVER.oracleId,
  name: LORE_WEAVER.name,
  activated: [
    {
      ref: `${LORE_WEAVER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
