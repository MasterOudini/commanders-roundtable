// `Sliver Overlord` - an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SLIVER_OVERLORD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SLIVER_OVERLORD, "{3}: Search your library for a Sliver card, reveal that card, put it into your hand, then shuffle.\n{3}: Gain control of target Sliver. (This effect lasts indefinitely.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Search your library for a Sliver card, reveal that card, put it into your hand, then shuffle.", SLIVER_OVERLORD.name);
const VOCAB_T_A0 = vocabularyTargets("Search your library for a Sliver card, reveal that card, put it into your hand, then shuffle.");
const VOCAB_A1 = vocabularyEffects("Gain control of target Sliver.", SLIVER_OVERLORD.name);
const VOCAB_T_A1 = vocabularyTargets("Gain control of target Sliver.");

export const SLIVER_OVERLORD_SCRIPT: CardScript = {
  oracleId: SLIVER_OVERLORD.oracleId,
  name: SLIVER_OVERLORD.name,
  activated: [
    {
      ref: `${SLIVER_OVERLORD.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${SLIVER_OVERLORD.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
