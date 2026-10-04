// `Silklash Spider` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SILKLASH_SPIDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SILKLASH_SPIDER, "Reach\n{X}{G}{G}: This creature deals X damage to each creature with flying.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ deals X damage to each creature with flying.", SILKLASH_SPIDER.name, { xCost: true });
const VOCAB_T_A0 = vocabularyTargets("~ deals X damage to each creature with flying.");

export const SILKLASH_SPIDER_SCRIPT: CardScript = {
  oracleId: SILKLASH_SPIDER.oracleId,
  name: SILKLASH_SPIDER.name,
  activated: [
    {
      ref: `${SILKLASH_SPIDER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
