// `Selesnya Keyrune` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SELESNYA_KEYRUNE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SELESNYA_KEYRUNE, "{T}: Add {G} or {W}.\n{G}{W}: This artifact becomes a 3/3 green and white Wolf artifact creature until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("~ becomes a 3/3 green and white Wolf artifact creature until end of turn.", SELESNYA_KEYRUNE.name);
const VOCAB_T_A1 = vocabularyTargets("~ becomes a 3/3 green and white Wolf artifact creature until end of turn.");

export const SELESNYA_KEYRUNE_SCRIPT: CardScript = {
  oracleId: SELESNYA_KEYRUNE.oracleId,
  name: SELESNYA_KEYRUNE.name,
  activated: [
    {
      ref: `${SELESNYA_KEYRUNE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
