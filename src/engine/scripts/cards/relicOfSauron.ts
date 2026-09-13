// `Relic of Sauron` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RELIC_OF_SAURON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RELIC_OF_SAURON, "{T}: Add two mana in any combination of {U}, {B}, and/or {R}.\n{3}, {T}: Draw two cards, then discard a card.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Draw two cards, then discard a card.", RELIC_OF_SAURON.name);
const VOCAB_T_A1 = vocabularyTargets("Draw two cards, then discard a card.");

export const RELIC_OF_SAURON_SCRIPT: CardScript = {
  oracleId: RELIC_OF_SAURON.oracleId,
  name: RELIC_OF_SAURON.name,
  activated: [
    {
      ref: `${RELIC_OF_SAURON.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
