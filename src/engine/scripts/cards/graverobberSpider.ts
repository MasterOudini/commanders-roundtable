// `Graverobber Spider` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GRAVEROBBER_SPIDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GRAVEROBBER_SPIDER, "Reach\n{3}{B}: This creature gets +X/+X until end of turn, where X is the number of creature cards in your graveyard. Activate only once each turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ gets +X/+X until end of turn, where X is the number of creature cards in your graveyard.", GRAVEROBBER_SPIDER.name);
const VOCAB_T_A0 = vocabularyTargets("~ gets +X/+X until end of turn, where X is the number of creature cards in your graveyard.");

export const GRAVEROBBER_SPIDER_SCRIPT: CardScript = {
  oracleId: GRAVEROBBER_SPIDER.oracleId,
  name: GRAVEROBBER_SPIDER.name,
  activated: [
    {
      ref: `${GRAVEROBBER_SPIDER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
