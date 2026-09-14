// `Geier Reach Sanitarium` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GEIER_REACH_SANITARIUM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GEIER_REACH_SANITARIUM, "{T}: Add {C}.\n{2}, {T}: Each player draws a card, then discards a card.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Each player draws a card, then discards a card.", GEIER_REACH_SANITARIUM.name);
const VOCAB_T_A1 = vocabularyTargets("Each player draws a card, then discards a card.");

export const GEIER_REACH_SANITARIUM_SCRIPT: CardScript = {
  oracleId: GEIER_REACH_SANITARIUM.oracleId,
  name: GEIER_REACH_SANITARIUM.name,
  activated: [
    {
      ref: `${GEIER_REACH_SANITARIUM.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
