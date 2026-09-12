// `Cori Mountain Monastery` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CORI_MOUNTAIN_MONASTERY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CORI_MOUNTAIN_MONASTERY, "This land enters tapped unless you control a Plains or an Island.\n{T}: Add {R}.\n{3}{R}, {T}: Exile the top card of your library. Until the end of your next turn, you may play that card.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Exile the top card of your library. Until the end of your next turn, you may play that card.", CORI_MOUNTAIN_MONASTERY.name);
const VOCAB_T_A1 = vocabularyTargets("Exile the top card of your library. Until the end of your next turn, you may play that card.");

export const CORI_MOUNTAIN_MONASTERY_SCRIPT: CardScript = {
  oracleId: CORI_MOUNTAIN_MONASTERY.oracleId,
  name: CORI_MOUNTAIN_MONASTERY.name,
  activated: [
    {
      ref: `${CORI_MOUNTAIN_MONASTERY.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
