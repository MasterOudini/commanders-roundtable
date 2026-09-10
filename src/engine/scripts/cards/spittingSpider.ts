// `Spitting Spider` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPITTING_SPIDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPITTING_SPIDER, "Reach (This creature can block creatures with flying.)\nSacrifice a land: This creature deals 1 damage to each creature with flying.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ deals 1 damage to each creature with flying.", SPITTING_SPIDER.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals 1 damage to each creature with flying.");

export const SPITTING_SPIDER_SCRIPT: CardScript = {
  oracleId: SPITTING_SPIDER.oracleId,
  name: SPITTING_SPIDER.name,
  activated: [
    {
      ref: `${SPITTING_SPIDER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
