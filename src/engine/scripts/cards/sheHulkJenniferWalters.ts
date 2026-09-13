// `She-Hulk, Jennifer Walters` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SHE_HULK_JENNIFER_WALTERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SHE_HULK_JENNIFER_WALTERS, "Trample (This creature can deal excess combat damage to the player she's attacking.)\n{2}{R}, Sacrifice a land: Draw a card and put a +1/+1 counter on She-Hulk.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Draw a card and put a +1/+1 counter on ~.", SHE_HULK_JENNIFER_WALTERS.name);
const VOCAB_T_A0 = vocabularyTargets("Draw a card and put a +1/+1 counter on ~.");

export const SHE_HULK_JENNIFER_WALTERS_SCRIPT: CardScript = {
  oracleId: SHE_HULK_JENNIFER_WALTERS.oracleId,
  name: SHE_HULK_JENNIFER_WALTERS.name,
  activated: [
    {
      ref: `${SHE_HULK_JENNIFER_WALTERS.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
