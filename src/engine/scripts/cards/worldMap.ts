// `World Map` - an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WORLD_MAP } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WORLD_MAP, "{1}, {T}, Sacrifice this artifact: Search your library for a basic land card, reveal it, put it into your hand, then shuffle.\n{3}, {T}, Sacrifice this artifact: Search your library for a land card, reveal it, put it into your hand, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Search your library for a basic land card, reveal it, put it into your hand, then shuffle.", WORLD_MAP.name);
const VOCAB_T_A0 = vocabularyTargets("Search your library for a basic land card, reveal it, put it into your hand, then shuffle.");
const VOCAB_A1 = vocabularyEffects("Search your library for a land card, reveal it, put it into your hand, then shuffle.", WORLD_MAP.name);
const VOCAB_T_A1 = vocabularyTargets("Search your library for a land card, reveal it, put it into your hand, then shuffle.");

export const WORLD_MAP_SCRIPT: CardScript = {
  oracleId: WORLD_MAP.oracleId,
  name: WORLD_MAP.name,
  activated: [
    {
      ref: `${WORLD_MAP.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${WORLD_MAP.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
