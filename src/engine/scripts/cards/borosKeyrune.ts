// `Boros Keyrune` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BOROS_KEYRUNE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BOROS_KEYRUNE, "{T}: Add {R} or {W}.\n{R}{W}: This artifact becomes a 1/1 red and white Soldier artifact creature with double strike until end of turn. (It deals both first-strike and regular combat damage.)");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("~ becomes a 1/1 red and white Soldier artifact creature with double strike until end of turn.", BOROS_KEYRUNE.name);
const VOCAB_T_A1 = vocabularyTargets("~ becomes a 1/1 red and white Soldier artifact creature with double strike until end of turn.");

export const BOROS_KEYRUNE_SCRIPT: CardScript = {
  oracleId: BOROS_KEYRUNE.oracleId,
  name: BOROS_KEYRUNE.name,
  activated: [
    {
      ref: `${BOROS_KEYRUNE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
