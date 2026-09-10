// `Brightwood Tracker` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BRIGHTWOOD_TRACKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BRIGHTWOOD_TRACKER, "{5}{G}, {T}: Look at the top four cards of your library. You may reveal a creature card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.");

const VOCAB_A0 = vocabularyEffects("Look at the top four cards of your library. You may reveal a creature card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.", BRIGHTWOOD_TRACKER.name);
const VOCAB_T_A0 = vocabularyTargets("Look at the top four cards of your library. You may reveal a creature card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.");

export const BRIGHTWOOD_TRACKER_SCRIPT: CardScript = {
  oracleId: BRIGHTWOOD_TRACKER.oracleId,
  name: BRIGHTWOOD_TRACKER.name,
  activated: [
    {
      ref: `${BRIGHTWOOD_TRACKER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
