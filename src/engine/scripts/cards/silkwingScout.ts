// `Silkwing Scout` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SILKWING_SCOUT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SILKWING_SCOUT, "Flying\n{G}, Sacrifice this creature: Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.", SILKWING_SCOUT.name);
const VOCAB_T_A0 = vocabularyTargets("Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.");

export const SILKWING_SCOUT_SCRIPT: CardScript = {
  oracleId: SILKWING_SCOUT.oracleId,
  name: SILKWING_SCOUT.name,
  activated: [
    {
      ref: `${SILKWING_SCOUT.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
